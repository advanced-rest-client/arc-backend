import { v4 as uuidv4 } from '@advanced-rest-client/uuid-generator';
import { BaseModel } from './BaseModel.js';

/** @typedef {import('@google-cloud/datastore/build/src/entity').entity.Key} Key */
/** @typedef {import('@google-cloud/datastore').Transaction} Transaction */
/** @typedef {import('./TestReport').TestReport} TestReport */
/** @typedef {import('./TestModel').TestEntity} TestEntity */
/** @typedef {import('./TestModel').TestQueryOptions} TestQueryOptions */
/** @typedef {import('./TestModel').TestQueryResult} TestQueryResult */
/** @typedef {import('./TestModel').EditableTestEntity} EditableTestEntity */
/** @typedef {import('./TestModel').EditableBottpmUpEntity} EditableBottpmUpEntity */

/**
 * A model for catalog items.
 */
export class TestModel extends BaseModel {
  /**
   * @constructor
   */
  constructor() {
    super('api-components-tests');
  }

  /**
   * @return {string[]} Model properties excluded from indexes
   */
  get excludedIndexes() {
    return [
      'type',
      'commit',
      'branch',
      'status',
      'size',
      'passed',
      'failed',
      'component',
      'error',
      'message',
      'includeDev',
      'org',
      'creator.id',
      'creator.displayName',
    ];
  }

  /**
   * Lists test scheduled in the data store.
   * @param {TestQueryOptions=} [opts={}] Query options
   * @return {Promise<TestQueryResult>}
   */
  async list(opts={}) {
    const { limit=this.listLimit, pageToken } = opts;
    let query = this.store.createQuery(this.namespace, this.testKind);
    query = query.limit(limit);
    query = query.order('created', {
      descending: true,
    });
    if (pageToken) {
      query = query.start(pageToken);
    }
    const [entitiesRaw, queryInfo] = await this.store.runQuery(query);
    const entities = /** @type TestEntity[] */ (entitiesRaw.map(this.fromDatastore.bind(this)));
    const newPageToken = queryInfo.moreResults !== this.NO_MORE_RESULTS ? queryInfo.endCursor : undefined;
    return {
      entities,
      pageToken: newPageToken,
    };
  }

  /**
   * Insets a test to the data store.
   * NOTE, it won't schedule a test in the corresponding background application.
   *
   * @param {EditableTestEntity} info Entity description
   * @return {Promise<string>} The key value of the generated identifier for the entity
   */
  async insertTest(info) {
    const now = Date.now();
    const keyName = uuidv4();
    const key = this.createTestKey(keyName);
    const results = [
      {
        name: 'type',
        value: info.type,
        excludeFromIndexes: true,
      },
      {
        name: 'branch',
        value: info.branch,
        excludeFromIndexes: true,
      },
      {
        name: 'created',
        value: now,
      },
      {
        name: 'status',
        value: 'queued',
        excludeFromIndexes: true,
      },
      {
        name: 'creator',
        value: info.creator,
        excludeFromIndexes: true,
      },
    ];

    if (info.commit) {
      results.push({
        name: 'commit',
        value: info.commit,
        excludeFromIndexes: true,
      });
    }
    if (info.purpose) {
      results.push({
        name: 'purpose',
        value: info.purpose,
        excludeFromIndexes: true,
      });
    }
    const bottomUpType = /** @type EditableBottpmUpEntity */ (info);

    if (bottomUpType.component) {
      results.push({
        name: 'component',
        value: bottomUpType.component,
        excludeFromIndexes: true,
      });
    }
    if (bottomUpType.org) {
      results.push({
        name: 'org',
        value: bottomUpType.org,
        excludeFromIndexes: true,
      });
    }

    if (typeof bottomUpType.includeDev === 'boolean') {
      results.push({
        name: 'includeDev',
        // @ts-ignore
        value: bottomUpType.includeDev,
        excludeFromIndexes: true,
      });
    }
    const entity = {
      key,
      data: results,
    };
    await this.store.upsert(entity);
    return keyName;
  }

  /**
   * Resets test state.
   * NOTE, it won't schedule a test in the corresponding background application.
   *
   * @param {string} testId The ID of the test to reset.
   * @return {Promise<void>}
   */
  async resetTest(testId) {
    const transaction = this.store.transaction();
    const key = this.createTestKey(testId);
    try {
      await transaction.run();
      const [test] = await transaction.get(key);
      test.status = 'queued';
      delete test.passed;
      delete test.failed;
      delete test.size;
      delete test.startTime;
      delete test.error;
      delete test.message;
      transaction.save({
        key,
        data: test,
        excludeFromIndexes: this.excludedIndexes,
      });
      await this._deleteLogs(transaction, key);
      await this._deleteComponents(transaction, key);
      await transaction.commit();
    } catch (e) {
      transaction.rollback();
      throw e;
    }
  }

  /**
   * Gets test definition from the store.
   * @param {string} id The ID of the test.
   * @return {Promise<TestEntity|null>}
   */
  async getTest(id) {
    const key = this.createTestKey(id);
    const [entity] = await this.store.get(key);
    if (entity) {
      return this.fromDatastore(entity[0]);
    }
    return null;
  }

  /**
   * Marks test as started
   * @param {string} id The ID of the test.
   * @return {Promise<void>}
   */
  async startTest(id) {
    await this.updateTestProperties(id, {
      status: 'running',
      startTime: Date.now(),
    });
  }

  /**
   * Marks test as errored
   * @param {string} id The ID of the test.
   * @param {string} message The error message from the test run
   * @return {Promise<void>}
   */
  async setTestError(id, message) {
    await this.updateTestProperties(id, {
      status: 'finished',
      endTime: Date.now(),
      error: true,
      message,
    });
  }

  /**
   * Updates the information about the number of components in the test
   * @param {string} id The ID of the test.
   * @param {string} size The error message from the test run
   * @return {Promise<void>}
   */
  async updateTestScope(id, size) {
    await this.updateTestProperties(id, {
      size,
    });
  }

  /**
   * Marks component as errored
   * @param {String} id The ID of the test.
   * @return {Promise<void>}
   */
  async setComponentError(id) {
    const transaction = this.store.transaction();
    const key = this.createTestKey(id);
    try {
      await transaction.run();
      const [test] = await transaction.get(key);
      if (test.status === 'queued') {
        test.status = 'running';
      }
      if (!test.failed) {
        test.failed = 0;
      }
      test.failed++;
      transaction.save({
        key,
        data: test,
        excludeFromIndexes: this.excludedIndexes,
      });
      await transaction.commit();
    } catch (e) {
      transaction.rollback();
      throw e;
    }
  }

  /**
   * Updates Test with the test result
   * @param {String} id The ID of the test.
   * @param {TestReport} report Test run report
   * @return {Promise<void>}
   */
  async updateComponentResult(id, report) {
    const transaction = this.store.transaction();
    const key = this.createTestKey(id);
    try {
      await transaction.run();
      const data = await transaction.get(key);
      const [test] = data;
      if (test.status === 'queued') {
        test.status = 'running';
      }
      if (!report.error) {
        if (!test.passed) {
          test.passed = 0;
        }
        test.passed++;
      } else {
        if (!test.failed) {
          test.failed = 0;
        }
        test.failed++;
      }
      transaction.save({
        key,
        data: test,
        excludeFromIndexes: this.excludedIndexes,
      });
      await transaction.commit();
    } catch (cause) {
      transaction.rollback();
      throw cause;
    }
  }

  /**
   * Marks test as ended
   * @param {String} id The ID of the test.
   * @param {string=} message Optional message to add to the result.
   * @return {Promise<void>} [description]
   */
  async finishTest(id, message) {
    const props = {
      status: 'finished',
      endTime: Date.now(),
    };
    if (message) {
      props.message = message;
    }
    await this.updateTestProperties(id, props);
  }

  /**
   * Updates test properties in a transaction
   * @param {String} id The ID of the test.
   * @param {object} props A properties to update
   * @return {Promise<void>} [description]
   */
  async updateTestProperties(id, props) {
    const transaction = this.store.transaction();
    const key = this.createTestKey(id);
    try {
      await transaction.run();
      const data = await transaction.get(key);
      const [test] = data;
      Object.keys(props).forEach((key) => {
        test[key] = props[key];
      });
      transaction.save({
        key,
        data: test,
        excludeFromIndexes: this.excludedIndexes,
      });
      await transaction.commit();
    } catch (cause) {
      transaction.rollback();
      throw cause;
    }
  }

  /**
   * Removes the test from the data store.
   * @param {string} id The id of the test
   * @return {Promise<void>}
   */
  async deleteTest(id) {
    const transaction = this.store.transaction();
    const key = this.createTestKey(id);
    try {
      await transaction.run();
      transaction.delete(key);
      await this._deleteLogs(transaction, key);
      await this._deleteComponents(transaction, key);
      await transaction.commit();
    } catch (cause) {
      transaction.rollback();
      throw cause;
    }
  }

  /**
   * Deletes components associated with a test
   * @param {Transaction} transaction Running transaction
   * @param {Key} key Test key
   * @return {Promise<void>}
   */
  async _deleteComponents(transaction, key) {
    const cmpQuery = transaction.createQuery(this.namespace, this.componentsKind).hasAncestor(key);
    const cmpResult = await cmpQuery.run();
    const cmpKeys = cmpResult[0].map((item) => item[this.store.KEY]);
    if (cmpKeys.length) {
      transaction.delete(cmpKeys);
    }
  }

  /**
   * Deletes logs associated with a test
   * @param {Transaction} transaction Running transaction
   * @param {Key} key Test key
   * @return {Promise<void>}
   */
  async _deleteLogs(transaction, key) {
    const logsQuery = transaction.createQuery(this.namespace, this.testLogsKind).hasAncestor(key);
    const logsResult = await logsQuery.run();
    const logsKeys = logsResult[0].map((item) => item[this.store.KEY]);
    if (logsKeys.length) {
      transaction.delete(logsKeys);
    }
  }
}
