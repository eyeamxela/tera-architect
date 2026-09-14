# TERA Architect variable catalog

Generated from `app/design-model.ts`. Labels and units match the implemented forms. Research basis: [ARCHITECT-RESEARCH.md](ARCHITECT-RESEARCH.md). Empty numeric fields are `null`; empty text is not a verified observation.

## Land development

Stored in `designScope.sections.land`.

### Brief

| Key | Input | Unit / note |
| --- | --- | --- |
| intent | Land use & desired outcome | Text |
| survey | Boundary / topographic survey reference | Text |
| area | Work area | sq ft |
| soil | Soil, geotechnical & infiltration findings | Text |
| water | Catchment, water storage & safe overflow | Text |
| keyline | Keyline / contour design basis | Surveyed levels, keypoints and proposed grades; GIS is a reference. |
| access | Access, slope & equipment constraints | Text |
| utilities | Utilities, easements & ecological constraints | Text |
| planting | Species, spacing, irrigation & establishment | Text |
| jurisdiction | Planning authority & permit review reference | Text |

### Repeatable work area schedule

| Key | Input | Unit / note |
| --- | --- | --- |
| name | Work area name | Text |
| quantity | Quantity | Number |
| unit | Unit (sq ft, lin ft, trees, cu yd) | Text |
| spec | Preparation, materials & maintenance | Text |

### Default services

- Survey & site assessment
- Water, access & keyline concept
- Detailed design & permit review
- Earthworks & installation
- Establishment & handover

### Suggested estimate packages

- Survey & land design — rate unpriced
- Unmapped land works — rate unpriced
- Establishment & maintenance allowance — rate unpriced

## Architecture

Stored in `designScope.sections.architecture`.

### Brief

| Key | Input | Unit / note |
| --- | --- | --- |
| intent | Project brief & success criteria | Text |
| type | Building type / new build / addition / renovation | Text |
| grossArea | Gross floor area | sq ft |
| existingArea | Existing area retained | sq ft |
| storeys | Number of storeys | Number |
| occupancy | Intended occupancy, users & room program | Text |
| construction | Structural system & envelope approach | Text |
| performance | Energy, comfort & sustainability targets | Text |
| consultants | Structural / MEP / civil / energy consultants | Text |
| jurisdiction | Authority, zoning & code review reference | Record verified setbacks, height, lot coverage and constraints; no automatic entitlement. |
| accessibility | Accessibility scope & reviewer | Text |
| delivery | Delivery method & construction administration scope | Text |

### Repeatable space schedule

| Key | Input | Unit / note |
| --- | --- | --- |
| name | Space / zone | Text |
| area | Net area | sq ft |
| count | Count | Number |
| requirements | Adjacencies, services & performance | Text |

### Default services

- Brief & feasibility
- Schematic design
- Design development & coordination
- Construction documents
- Bidding / procurement
- Construction administration & handover

### Suggested estimate packages

- Architect design & documentation fee — rate unpriced
- Consultant services — rate unpriced
- Construction works excluding other disciplines — rate unpriced
- Authority fees & surveys — rate unpriced
- Construction administration — rate unpriced

## Interior design

Stored in `designScope.sections.interiors`.

### Brief

| Key | Input | Unit / note |
| --- | --- | --- |
| intent | Design direction & experience | Text |
| area | Interior work area | sq ft |
| occupancy | Users, accessibility & operational needs | Text |
| retain | Existing elements retained / removed | Text |
| lighting | Lighting, electrical & reflected ceiling coordination | Text |
| wet | Wet areas, plumbing & waterproofing scope | Text |
| performance | Acoustics, durability, indoor air & maintenance targets | Text |
| procurement | Who purchases, receives & installs FF&E? | Text |
| furnitureOwnership | Furniture cost boundary | Keep bespoke pieces in Custom furniture; specify exclusions here to avoid counting them twice. |
| jurisdiction | Permit / code / accessibility reviewer & reference | Text |

### Repeatable room schedule

| Key | Input | Unit / note |
| --- | --- | --- |
| name | Room name / number | Text |
| area | Area | sq ft |
| ceilingHeight | Ceiling height | ft |
| finishes | Floor, wall, ceiling finish codes | Text |
| fixtures | Lighting, hardware, fixtures & FF&E codes | Text |
| reference | Drawing / finish sample / supplier reference | Text |

### Default services

- Brief, measure & space plan
- Concept & material palette
- Drawings, finish & FF&E schedules
- Samples & client selections
- Procurement & installation
- Snagging & care handover

### Suggested estimate packages

- Interior design & documentation — rate unpriced
- Interior finishes & installation — rate unpriced
- Lighting, fixtures & standard FF&E — rate unpriced
- Procurement & receiving — rate unpriced
- Delivery, installation & styling — rate unpriced

## Custom furniture

Stored in `designScope.sections.furniture`.

### Brief

| Key | Input | Unit / note |
| --- | --- | --- |
| intent | Collection brief & intended use | Text |
| maker | Fabricator / maker & contact reference | Text |
| environment | Indoor / outdoor use, humidity & site conditions | Text |
| performance | Load, durability & testing requirements | Product-specific testing or certification must be confirmed by the maker. |
| joinery | Joinery, tolerances, fixing & assembly strategy | Text |
| samples | Shop drawing, sample & prototype approvals required | Text |
| delivery | Delivery access, protection, storage & installation | Text |
| warranty | Warranty, care & repair commitments | Text |

### Repeatable piece schedule

| Key | Input | Unit / note |
| --- | --- | --- |
| name | Piece name / drawing number | Text |
| quantity | Quantity | Number |
| width | Width | Number |
| depth | Depth | Number |
| height | Height | Number |
| dimensionUnit | Dimension unit (in / mm) | Text |
| material | Species, core, grade & material quantity | Text |
| finish | Finish / sheen / approved sample | Text |
| hardware | Hardware, upholstery & supplier codes | Text |
| fabricationHours | Fabrication hours per piece | hr |
| leadWeeks | Supplier lead time | weeks |
| reference | Measured / approved drawing revision | Text |

### Default services

- Brief & verified field dimensions
- Design & shop drawings
- Material samples / prototype approval
- Fabrication & quality review
- Delivery & installation
- Care & warranty handover

### Suggested estimate packages

- Furniture design & shop drawings — rate unpriced
- Materials, hardware & upholstery — rate unpriced
- Fabrication & finishing labor — rate unpriced
- Prototype / testing allowance — rate unpriced
- Packing, freight & installation — rate unpriced

## Common state and limits

| Variable | Meaning | Limit / calculation |
| --- | --- | --- |
| version | Design contract version | 1 |
| enabled | Included disciplines | 1–4 unique IDs; all 15 combinations supported |
| taxPercent | Tax on marked discipline costs | 0–100%; team-entered; default 0 |
| planning.budget | Client allowance, USD | 0–10,000,000; default 0 |
| planning.contingency | Reserve percentage | 0–100%; default 0 |
| section.brief / entries[].values | Specification values | Only catalog keys; numbers 0–1,000,000 or null; text up to 6,000 characters |
| section.entries | Rooms / spaces / pieces / work areas | Up to 100; unique IDs per section |
| costs[].quantity | Priced quantity | 0–1,000,000 or null |
| costs[].unit | Rate unit | 1–30 characters; no automatic unit conversion |
| costs[].rate | USD per unit | 0–10,000,000 or null; calculation rounds to cents |
| costs[].basis | Price evidence | allowance, quote, actual |
| costs[].reference | Scope/quote/invoice reference | Required for included quote or actual lines before publishing |
| costs[].taxable | Apply entered tax | Boolean, default false |
| costs[].included | Count this estimate line | Boolean; up to 100 costs per section |
| stages[] | Services / deliverables | Included, recorded status, responsible person; up to 30 |
| startWeek | Earliest procurement/approval start | Integer 0–520 or null, relative to kickoff |
| leadWeeks | Lead time before work | Integer 0–520 or null |
| durationWeeks | Work after lead time | Integer 0–520 or null |
| dependsOn | Must finish before this scope starts | Up to 3 unique other disciplines; no cycles |
| exclusions | Scope boundaries and responsibilities | Text up to 6,000 characters |

The base `planning.months`, `carePerTree` and `priority` fields remain for backward compatibility with legacy TERA proposals. They do not drive the architect edition's schedule or investment totals. Establishment or other operating costs are explicit estimate lines in the new plan.

All four sections persist privately even when inactive. Publication retains only the selected section content and clears land data when Land is inactive. Attached documents are published only when explicitly selected in Files; document selection is independent of discipline selection.
