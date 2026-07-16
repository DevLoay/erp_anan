# Rider documents regex fix

Fixes an invalid regex character class in `src/lib/rider-documents/getRiderDocumentsData.ts`.

The broken regex looked like:

```ts
/[s-_/\.]+/g
```

or similar. The safe version is:

```ts
/[\s_./-]+/g
```

The hyphen is placed at the end of the character class so JavaScript does not treat it as a range.
