# Public API catalog

`public-apis-readme.md` is the source snapshot. `Public_APIs_Catalog_and_CRM_Fit.docx` is generated from it by [`scripts/build_public_apis_catalog.py`](../../../scripts/build_public_apis_catalog.py).

Install the pinned documentation dependency with `python -m pip install -r scripts/requirements-docs.txt` from the repository root, then regenerate with `python scripts/build_public_apis_catalog.py`.

The generator is currently verified with Python 3.14.7 and `python-docx==1.2.0`. The DOCX generation date and the No-Auth + HTTPS count are derived at runtime from the source snapshot.
