import { Datastore } from '@google-cloud/datastore';
import {entity} from '@google-cloud/datastore/build/src/entity';

export interface Entity {
  id: string;
}

export declare interface QueryResult<T> {
  /**
   * Datastore query start token.
   */
  pageToken?: string;
  /**
   * The list of results to communicate back.
   */
  entities: T[];
}

export interface QueryOptions {
  /**
   * Number of results to return in the query.
   */
  limit?: number;
  /**
   * Datastore query start token.
   */
  pageToken?: string;
}

/**
 * A base model for all datastore model classes.
 */
export declare class BaseModel {
  namespace: string;
  store: Datastore;
  listLimit: number;
  /**
   * @param namespace Datastore namespace to use with datastore requests.
   */
  constructor(namespace: string);

  /**
   * A symbol representing no more results in the data store
   */
  get NO_MORE_RESULTS(): string;

  /**
   * The kind value for tests
   */
   get testKind(): string;

  /**
   * The kind value for components
   */
   get componentsKind(): string;

  /**
   * The kind value for versions
   */
   get versionsKind(): string;

  /**
   * The kind value for groups
   */
   get organizationKind(): string;

  /**
   * The kind value for test logs
   */
   get testLogsKind(): string;

  /**
   * The kind value for users
   */
   get userKind(): string;

  /**
   * The kind value for JWT tokens
   */
   get tokenKind(): string;

  /**
   * The kind value for builds
   */
   get buildKind(): string;

  /**
   * The kind value for messages (ARC messages)
   */
   get messageKind(): string;

  /**
   * The kind value for dependencies
   */
   get dependencyKind(): string;

  /**
   * The kind value for coverage run
   */
   get coverageRunKind(): string;

  /**
   * The kind value for coverage run
   */
   get coverageComponentKind(): string;

  /**
   * The namespace value for users
   */
   get apicUsersNamespace(): string;

  /**
   * The namespace value for tests
   */
   get apicTestsNamespace(): string;

  /**
   * The namespace value for builds
   */
   get buildsNamespace(): string;

  /**
   * The namespace value for coverage
   */
   get coverageNamespace(): string;

  /**
   * Creates a slug from a string.
   *
   * @params name Value to slug,
   */
  slug(name: string): string;

  /**
   * Translates from Data store entity format to
   * the format expected by the application.
   *
   * Datastore format:
   *    {
   *      key: [kind, id],
   *      data: {
   *        property: value
   *      }
   *    }
   *
   *  Application format:
   *    {
   *      id: id,
   *      property: value
   *    }
   * @param obj Datastore entry
   */
  fromDatastore<T>(obj: T): T;

  /**
   * Creates a datastore key for a test.
   * @param testId Test id
   * @returns Datastore key
   */
  createTestKey(testId: string): entity.Key;

  /**
   * Creates a datastore key for a coverage test run
   * @param runId Test id
   * @returns Datastore key
   */
  createCoverageRunKey(runId: string): entity.Key;

  /**
   * Creates a datastore key for a component in a test.
   * @param testId Test id
   * @param componentName Component name
   * @returns Datastore key
   */
  createTestComponentKey(testId: string, componentName: string): entity.Key;

  /**
   * Creates a key for test logs
   *
   * @param testId Test id
   * @param componentName Component name
   * @param id The id of the log
   * @returns Datastore key
   */
  createTestLogKey(testId: string, componentName: string, id: string): entity.Key;

  /**
   * Creates a datastore key for a build.
   * @param id Build id
   * @returns Datastore key
   */
  createBuildKey(id: string): entity.Key;

  /**
   * Creates an key for a coverage result entry for a file
   * @param component The name of the component
   * @param org Component's organization
   * @param version Version of the component
   * @param file Covered file name
   */
  createComponentVersionFileCoverageKey(component: string, org: string, version: string, file: string): entity.Key;

  /**
   * Creates an key for a coverage result entry for a file
   * @param component The name of the component
   * @param org Component's organization
   * @param version Version of the component
   */
  createComponentVersionCoverageKey(component: string, org: string, version: string): entity.Key;

  /**
   * Creates an key for a coverage result entry for a file
   * @param component The name of the component
   * @param org Component's organization
   */
  createComponentCoverageKey(component: string, org: string): entity.Key;

  /**
   * Creates a datastore key for a user.
   * @param id OAuth returned user ID.
   */
  createUserKey(id: string): entity.Key;
  /**
   * Creates a datastore key for a user's token.
   * @param userId User ID.
   * @param tokenId Token id.
   */
  createUserTokenKey(userId: string, tokenId: string): entity.Key;
}
