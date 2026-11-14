import { describe, expect, it } from 'vitest';
import { canonicalJson } from './canonicalJson';

describe('canonicalJson', () => {
  it('sorts the keys of every object, so the text does not depend on the order they were written in', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}');
    expect(canonicalJson({ a: { c: 3, d: 2 }, b: 1 })).toBe(canonicalJson({ b: 1, a: { d: 2, c: 3 } }));
  });

  it('keeps the order of arrays and sorts the objects inside them', () => {
    expect(canonicalJson([{ b: 1, a: 2 }, [3, { z: 0, y: 1 }], 'x'])).toBe('[{"a":2,"b":1},[3,{"y":1,"z":0}],"x"]');
    expect(canonicalJson([2, 1])).not.toBe(canonicalJson([1, 2]));
  });

  it('drops an undefined member, so an absent field and an undefined one read the same', () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe('{"a":1}');
    expect(canonicalJson({ a: 1, b: undefined })).toBe(canonicalJson({ a: 1 }));
    expect(canonicalJson({ a: { b: undefined } })).toBe('{"a":{}}');
  });

  it('writes an undefined array item as null, as JSON.stringify does', () => {
    expect(canonicalJson([1, undefined, { a: undefined }])).toBe('[1,null,{}]');
    expect(canonicalJson({ list: [undefined] })).toBe('{"list":[null]}');
  });

  it('keeps null members and escapes keys and strings like JSON.stringify', () => {
    expect(canonicalJson({ n: null, 'a"b': 'c\nd' })).toBe('{"a\\"b":"c\\nd","n":null}');
  });

  it('writes scalars as JSON, and a bare undefined as null (it has no text of its own)', () => {
    expect(canonicalJson(12.5)).toBe('12.5');
    expect(canonicalJson('s')).toBe('"s"');
    expect(canonicalJson(null)).toBe('null');
    expect(canonicalJson(undefined)).toBe('null');
  });
});
