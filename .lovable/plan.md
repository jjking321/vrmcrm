# Highway Suffix Extraction - IMPLEMENTED

The highway suffix extraction logic has been added to `src/lib/mailingAddress.ts`.

## Changes Made

1. Added `HIGHWAY_IN_CITY_PATTERN` regex to detect highway suffixes at start of city field
2. Added extraction logic after directional check in `deriveMailingFields()`

## Test Cases

| Street Input | City Input | Expected Address | Expected City |
|--------------|------------|------------------|---------------|
| `84773 Old` | `Hwy Islamorada` | `84773 Old Hwy` | `Islamorada` |
| `100 State` | `Highway Tampa` | `100 State Highway` | `Tampa` |
| `500 County` | `Rte Boston` | `500 County Rte` | `Boston` |
| `200 Main St` | `Miami` | `200 Main St` | `Miami` (no change) |
