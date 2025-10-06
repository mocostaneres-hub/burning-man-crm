// Global type declarations to fix TypeScript compilation issues

declare global {
  interface Window {
    location: Location;
    open: (url: string, target?: string) => Window | null;
  }

  interface Navigator {
    share?: (data: ShareData) => Promise<void>;
    clipboard: Clipboard;
  }

  interface Clipboard {
    writeText: (text: string) => Promise<void>;
  }

  interface ShareData {
    title?: string;
    text?: string;
    url?: string;
  }

  interface Document {
    getElementById: (elementId: string) => HTMLElement | null;
    addEventListener: (type: string, listener: EventListener) => void;
    removeEventListener: (type: string, listener: EventListener) => void;
    body: HTMLBodyElement;
    hidden: boolean;
  }

  interface HTMLBodyElement {
    style: CSSStyleDeclaration;
  }

  interface CSSStyleDeclaration {
    overflow: string;
  }

  interface HTMLInputElement {
    files: FileList | null;
    value: string;
    checked: boolean;
    click: () => void;
  }

  interface HTMLTextAreaElement {
    value: string;
  }

  interface HTMLSelectElement {
    value: string;
  }

  interface FileList {
    readonly length: number;
    item(index: number): File | null;
    [index: number]: File;
  }

  interface File {
    readonly name: string;
    readonly size: number;
    readonly type: string;
  }

  interface FileReader {
    onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null;
    readAsDataURL: (file: Blob) => void;
  }

  interface FileReaderConstructor {
    new (): FileReader;
  }

  var FileReader: FileReaderConstructor;

  interface KeyboardEvent {
    key: string;
  }

  interface EventTarget {
    value?: string;
    checked?: boolean;
    files?: FileList | null;
  }

  interface HTMLElement {
    style: CSSStyleDeclaration;
  }

  // Global functions
  var JSON: {
    stringify: (value: any) => string;
    parse: (text: string) => any;
  };

  var window: Window;
  var document: Document;
  var navigator: Navigator;
  var console: Console;
  var localStorage: Storage;
  var sessionStorage: Storage;

  var Math: {
    random: () => number;
    floor: (x: number) => number;
    ceil: (x: number) => number;
    round: (x: number) => number;
  };

  var Date: {
    new (): Date;
    new (value: string | number): Date;
    new (year: number, month: number, date?: number, hours?: number, minutes?: number, seconds?: number, ms?: number): Date;
    now(): number;
    parse(dateString: string): number;
    UTC(year: number, month: number, date?: number, hours?: number, minutes?: number, seconds?: number, ms?: number): number;
  };

  interface Date {
    toLocaleDateString(): string;
    toLocaleDateString(locales?: string | string[], options?: Intl.DateTimeFormatOptions): string;
    toLocaleString(): string;
    toLocaleString(locales?: string | string[], options?: Intl.DateTimeFormatOptions): string;
    getFullYear(): number;
    getTime(): number;
  }

  var Error: {
    new (message?: string): Error;
    (message?: string): Error;
    readonly prototype: Error;
  };

  interface Error {
    name: string;
    message: string;
    stack?: string;
  }

  var Promise: {
    new <T>(executor: (resolve: (value: T | PromiseLike<T>) => void, reject: (reason?: any) => void) => void): Promise<T>;
    all<T>(values: readonly (T | PromiseLike<T>)[]): Promise<T[]>;
    reject<T = never>(reason?: any): Promise<T>;
    resolve<T>(value: T | PromiseLike<T>): Promise<T>;
  };

  interface Promise<T> {
    then<TResult1 = T, TResult2 = never>(
      onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
      onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
    ): Promise<TResult1 | TResult2>;
    catch<TResult = never>(
      onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null
    ): Promise<T | TResult>;
    finally(onfinally?: (() => void) | undefined | null): Promise<T>;
  }

  var decodeURIComponent: (encodedURIComponent: string) => string;
  var encodeURIComponent: (uriComponent: string | number | boolean) => string;
  var atob: (encodedData: string) => string;
  var btoa: (data: string) => string;
  var isNaN: (value: number) => boolean;
  var parseInt: (string: string, radix?: number) => number;
  var parseFloat: (string: string) => number;

  // Array and String methods
  interface Array<T> {
    length: number;
    map<U>(callbackfn: (value: T, index: number, array: T[]) => U, thisArg?: any): U[];
    filter<S extends T>(callbackfn: (value: T, index: number, array: T[]) => value is S, thisArg?: any): S[];
    filter(callbackfn: (value: T, index: number, array: T[]) => unknown, thisArg?: any): T[];
    find<S extends T>(predicate: (this: void, value: T, index: number, obj: T[]) => value is S, thisArg?: any): S | undefined;
    find(predicate: (value: T, index: number, obj: T[]) => unknown, thisArg?: any): T | undefined;
    some(predicate: (value: T, index: number, array: T[]) => unknown, thisArg?: any): boolean;
    includes(searchElement: T, fromIndex?: number): boolean;
    slice(start?: number, end?: number): T[];
    forEach(callbackfn: (value: T, index: number, array: T[]) => void, thisArg?: any): void;
    join(separator?: string): string;
  }

  interface String {
    length: number;
    charAt(pos: number): string;
    charCodeAt(index: number): number;
    includes(searchString: string, position?: number): boolean;
    indexOf(searchString: string, position?: number): number;
    lastIndexOf(searchString: string, position?: number): number;
    replace(searchValue: string | RegExp, replaceValue: string | ((substring: string, ...args: any[]) => string)): string;
    slice(start?: number, end?: number): string;
    split(separator?: string | RegExp, limit?: number): string[];
    substring(start: number, end?: number): string;
    substr(from: number, length?: number): string;
    toLowerCase(): string;
    toUpperCase(): string;
    trim(): string;
    toString(): string;
    startsWith(searchString: string, position?: number): boolean;
    endsWith(searchString: string, length?: number): boolean;
  }

  interface Number {
    toString(radix?: number): string;
  }

  interface RegExp {
    test(string: string): boolean;
  }

  interface RegExpConstructor {
    new (pattern: string | RegExp, flags?: string): RegExp;
    (pattern: string | RegExp, flags?: string): RegExp;
  }

  var RegExp: RegExpConstructor;

  // Utility types
  type Partial<T> = {
    [P in keyof T]?: T[P];
  };

  type Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // React types
  interface Function {
    (...args: any[]): any;
  }

  namespace React {
    type FC<P = {}> = (props: P) => JSX.Element | null;
    type Dispatch<A> = (value: A) => void;
    type SetStateAction<S> = S | ((prevState: S) => S);
    type ChangeEvent<T = Element> = {
      target: T & EventTarget;
    };
    type KeyboardEvent<T = Element> = {
      key: string;
      target: T & EventTarget;
    };
  }

  // Google OAuth types
  interface CredentialResponse {
    credential: string;
    select_by: string;
  }

  // Axios types
  interface AxiosResponse<T = any> {
    data: T;
    status: number;
    statusText: string;
    headers: any;
    config: any;
    request?: any;
  }

  interface AxiosRequestConfig {
    headers?: any;
    params?: any;
    timeout?: number;
  }

  interface CreateAxiosDefaults {
    baseURL?: string;
    headers?: any;
    timeout?: number;
  }
}

export {};
