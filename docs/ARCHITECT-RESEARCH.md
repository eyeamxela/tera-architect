# TERA Architect: research and scope decisions

Research date: 13 September 2026. This document explains the added templates. The field catalog is an implementation design informed by the primary sources below; it is not a reproduction of professional contracts, a prescriptive building code or a certified fabrication standard.

## Architecture

AIA describes a progression from schematic concepts through coordinated design and construction documentation, then procurement and construction-phase services. This supports separate deliverable gates and fee packages rather than a single undifferentiated construction cost. We add an initial brief/feasibility gate to capture the owner's program before those stages. [AIA: Defining the architect's basic services](https://www.aia.org/resource-center/defining-the-architects-basic-services).

TERA's inputs cover project type, gross/existing areas, storeys, occupancy and room requirements; structure/envelope and performance intent; consultant responsibilities; delivery method; and recorded jurisdiction/accessibility review references. Repeatable spaces hold names, counts, net areas and adjacency/service requirements. Fees for design, consultants and administration are separated from works, surveys and authority allowances. These are our practical data-model choices, not a claim that all services are required on every project. The user selects the contracted services.

Supplemental and additional services should be identified in the agreement rather than inferred from a template. The default gates are editable for inclusion, responsibility and recorded status. [AIA Contract Documents: B201 instructions](https://help.aiacontracts.com/hc/en-us/articles/1500010130741-Instructions-B201-2017-Standard-Form-of-Architect-s-Services-Design-and-Construction-Contract-Administration).

## Interior design

CIDQ's description covers space planning, material and finish selection, furniture/fixtures/equipment, environmental considerations, technical documentation and coordination. Accordingly the interior brief includes users, retained elements, lighting/electrical, wet areas, acoustic/durability/air-quality intent and purchasing responsibilities. A repeatable room schedule carries area, ceiling height, finish codes, fixture/FF&E codes and drawing or supplier references. [CIDQ: What is interior design?](https://www.cidq.org/about-cidq/what-is-interior-design/).

Our stages distinguish design direction, documentation, samples/selections, procurement, installation and care handover. Those gates support a client discussion without assuming one universal procurement model. Standard FF&E can be priced here; bespoke furniture is priced in the Furniture discipline when that module is selected. Architecture construction allowances should likewise state which interior work is already included.

Interior-design scope and credential requirements differ by jurisdiction. TERA records the applicable reviewer/reference rather than labeling a plan compliant. [CIDQ: Jurisdictions and requirements](https://www.cidq.org/for-certificate-holders/jurisdictions-and-requirements/).

## Custom furniture and architectural woodwork

AWI's submittal standards distinguish shop drawings, product/material information and approval samples. Its manufacturer responsibilities address construction and attachment details, referenced materials/hardware and changes with cost or schedule implications. These support recording a drawing revision and sample/prototype review before fabrication, rather than treating a render as a shop drawing. [AWI: Submittals, purpose and scope](https://awinet.org/standards/submittals/1-0-2-0-submittals/), [AWI: Manufacturer/supplier responsibilities](https://awinet.org/standards/requirements-category/manufacturer-supplier-responsibility/).

Our piece schedule captures quantity, width/depth/height with explicit in/mm unit, species/core/grade and material notes, finish, hardware/upholstery references, fabrication hours, supplier lead time and verified drawing reference. Project-wide inputs cover maker, indoor/outdoor conditions, joinery/tolerances/assembly, performance requirements, approvals, delivery/storage/installation and care/warranty commitments. Those are specifications, not automatic material takeoffs. Price materials, labor, prototype/testing and freight separately or enter an explicit supplier quote covering the agreed scope.

Moisture and environmental conditions matter because wood dimensions change with moisture content. The template includes that context without hardcoding one moisture target for every species and application. [USDA Forest Products Laboratory: Wood Handbook](https://research.fs.usda.gov/fpl/wood-handbook).

Furniture testing varies with product and use. The performance field requests applicable loads, durability/testing and evidence; selecting the furniture template does not imply BIFMA certification. [BIFMA: Standards descriptions](https://www.bifma.org/page/StandardsShortDesc).

## Land development retained

The original TERA workflow remains: source-attributed parcel/terrain context, calibrated planning measurements, work areas, planting spacing, access and water concepts. The added land brief records survey references, soil/infiltration, catchment/overflow, keyline/contour basis, utilities/easements, ecology, planting and establishment responsibility. Site and room/piece schedules are intentionally distinct.

Public elevation exports can be taken into open-source QGIS/GDAL using the inherited terrain workflow. Detailed survey, geotechnical interpretation, hydraulic design, legal development limits and engineered set-out still require project-specific source work. This fork adds no automatic CAD generation or legal-area calculator.

## Shared review variables

Accessible routes and connections are a coordinated site/building/interior issue, so each applicable brief can record its reviewer and basis. Do not apply a single set of dimensions to every project: applicability, existing conditions and jurisdiction matter. [U.S. Access Board: Accessible routes](https://www.access-board.gov/ada/guides/chapter-4-accessible-routes/).

Across disciplines, the implemented variables are: selected scope, intent, quantities/units, rate, allowance/quote/actual basis, reference, taxable flag, exclusions, responsible people, service inclusion, status, earliest start, lead time, duration and predecessor discipline. Global inputs are budget, tax percentage and contingency percentage. USD and relative weeks are the initial edition's conventions.

## Calculation and information boundaries

1. Source measurements and descriptive specifications remain separate from estimate quantities. A furniture width does not produce a lumber bill automatically; a floor area does not invent a construction unit rate.
2. Blank included costs are visibly unpriced and block publication. An explicit zero is allowed. Excluded work is visible as excluded in a selected discipline's client scope; entirely unselected disciplines are removed from the client DTO.
3. Estimates use cents. Tax applies to marked discipline lines; common/mapped lines are tax-inclusive. Contingency is applied once to the pre-tax subtotal. Actual tax applicability and contractual inclusions are entered by the team.
4. Duration is not inferred from budget. Completion uses entered start + lead + work duration, respecting finish-to-start discipline dependencies. Independent disciplines may overlap. An unknown predecessor completion makes dependent completion unknown.
5. Room/piece lead times are descriptive schedule inputs. The project lead must reconcile them into the discipline's overall lead-time allowance; the application does not automatically schedule procurement for each line.
6. Recorded stage status is a team assertion. Client acceptance of the scope is a separate authenticated, revision-bound event. Neither event is a permit, professional certification or fabrication release.
7. Budget reductions do not silently remove scope. Explicit inclusion changes show which deliverables and costs remain. Benefits are stated as the client's desired outcomes, without a fabricated ROI or appreciation forecast.

## Later product work

Useful next additions are stage-level payment and cash-flow schedules, reusable studio rate books, native measurement-unit selection, supplier purchase orders and tax rules, CAD/BIM references, room/piece dependencies, signed contracts, and drawing revision/transmittal tracking. These are not represented as functioning integrations in this edition.
