# Bulk standard-cost entry review

The existing individual standard-cost form remains available. Bulk entry is an additional button on the Standard Cost Setup page.

## Verify the workflow

1. Open Standard Cost Setup and select **Bulk Excel Standard Cost**.
2. Search and check several items. Mixed KG, LTR and PCS items are supported, up to 100 per workbook.
3. Choose the effective date and download the selected-item XLSX format.
4. Enter fixed BDT amounts directly in the yellow BDT cells. Government duties and LC margin use percentages in Value / rate (`15` or `15%`). All other expense heads are fixed BDT. Government duty percentages use total assessable value in this bulk format. PI and TT inputs use the selected foreign currency per stock unit. Rates, type and margin bank can be set per item. TT parties are selected on TT Opening.
5. Upload the completed XLSX and select **Process Excel**. Review validation reasons and recalculated per-unit/per-pack costs.
6. Select **Save all as new standard versions**. The entire valid batch is saved once; existing versions and LC snapshots are not overwritten.
7. **Undo last bulk save** restores the pre-import standards only while no later standard changes or LC references depend on that batch. It does not change transaction records.

The workbook includes every available standard cost head, including custom heads, stable cost codes and grouped totals. Bulk format v2 removes calculated copy cells from fixed expense rows. LC margin bank is immediately above LC margin, and assessable value is immediately above the government duties. The Reference sheet contains margin banks and instructions. Worksheets are unprotected so Excel does not show protected-cell warnings. Keep item headers, cost codes and formulas intact; input validation and ERP recalculation still apply. Import recalculates with ERP logic and ignores spreadsheet calculated totals. Draft records are not overwritten by bulk completed-version saves.

## Calculation checks performed

- Independent evaluation of the generated Excel formulas matched ERP results for mixed KG/LTR/PCS items, compound government duty bases, TT-only and LC+TT, margin exclusion, and per-pack totals.
- Real XLSX structure, input formats, dropdown lists and frozen panes were inspected. The workbook uses an unprotected, plain light header. Both uncompressed downloads and compressed workbook uploads passed browser parsing.
- Full browser flow passed selection, download, file processing, preview, atomic version save, undo and individual-form calculation checks.
- Invalid values, missing/duplicate/unknown codes, formula input, invalid parties, TT margin, custom heads, wide workbooks, storage quota failure, stale previews and LC-linked undo guards were checked.
- Microsoft Excel itself was not used; native Excel recalculation can be verified with the downloaded format.

## Isolated implementation

Only `index.html` integrates the feature. Its code and styles are in `bulk-standard-core.js`, `bulk-standard-template.js`, `bulk-standard-ui.js`, `bulk-standard-xlsx.js` and `bulk-standard.css`. The bulk feature does not replace the individual-entry form. Existing individual duty-base defaults remain unchanged. Imported duty costs carry an explicit assessable-value basis so their amounts remain consistent when loaded or captured in an LC. TT party was separately removed from both standard entry methods because it belongs to TT Opening. To remove the feature, remove its stylesheet/script tags from index.html and remove these five files. Removing code does not remove already imported data; use the guarded Undo action first if needed.
