# dane.gov.pl – harvester XML schema (vendored)

Files copied without changes from the official dane.gov.pl source code
(`https://dane.gov.pl/source-code/backend_latest.zip`, version 2.63.0, Nov 2026):

- `data/harvester/xml_import_otwarte_dane_1_13.xsd` – the current XML import schema
  (namespace `urn:otwarte-dane:harvester:1.13`) the portal uses to harvest datasets from providers,
- `data/test_samples/harvester/import_example1.13.xml` – the reference example.

The dane.gov.pl source code is published by KPRM / the Ministry of Digital Affairs under GNU GPL v3.0.
We use these files only to validate our `/api/dane-gov-pl/harvester.xml` export (see `backend/tests`).
