'use client';
import { useState, useRef, useEffect } from 'react';
import {
  MapPin,
  Search,
  Mountain,
  ArrowUpRight,
  ScanLine,
  Download,
  Check,
  Loader2,
  ArrowRight,
  Layers3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  type SiteAssessment,
  type AddressMatch,
  type Parcel,
  siteSources,
  parcelBounds,
  pixelPoint,
  feetPerPixel,
  planningAuthority,
  googleMapUrl,
  demExportUrl,
} from './site-data';

function download(text: string, filename: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function requestData(path: string, input: unknown, signal: AbortSignal) {
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  });
  const j = (await r.json()) as any;
  if (!r.ok) throw Error(j.error || 'Lookup unavailable. Please try again.');
  return j;
}
function outline(parcel: Parcel, bounds = parcelBounds(parcel.rings)) {
  return parcel.rings
    .map(
      (r) =>
        'M ' + r.map((p) => pixelPoint(p, bounds).join(',')).join(' L ') + ' Z',
    )
    .join(' ');
}
export function SiteEvidence({ site }: { site: SiteAssessment }) {
  return (
    <div className="site-evidence">
      <div>
        <span className="eyebrow">PROPERTY SOURCE RECORD</span>
        <h3>APN {site.parcel.apn}</h3>
        <p>
          {site.parcel.acres?.toLocaleString() ?? 'Unknown'} GIS acres ·{' '}
          {site.jurisdiction}
        </p>
      </div>
      <div>
        <span className="status amber">Legal / buildable area unverified</span>
        <p>
          County parcel geometry and USGS terrain retrieved{' '}
          {new Date(site.retrievedAt).toLocaleDateString('en-US')}. This does
          not establish a legal lot, allowable footprint, or permits.
        </p>
        <a href={planningAuthority(site)} target="_blank" rel="noreferrer">
          Planning authority <ArrowUpRight size={13} />
        </a>
      </div>
    </div>
  );
}
export default function SiteCheck({
  savedSite,
  onStart,
}: {
  savedSite?: SiteAssessment;
  onStart: (site: SiteAssessment) => void;
}) {
  const [address, setAddress] = useState(savedSite?.parcel.situs || '');
  const [matches, setMatches] = useState<AddressMatch[]>([]);
  const [matched, setMatched] = useState<AddressMatch | null>(null);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [site, setSite] = useState<SiteAssessment | null>(savedSite || null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [layer, setLayer] = useState('hillshade');
  const [profileLine, setProfileLine] = useState(true);
  const [imageFailed, setImageFailed] = useState(false);
  const [proposedUse, setProposedUse] = useState('Pond, planting & access');
  const pending = useRef<AbortController | null>(null);
  const requestId = useRef(0);
  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => setImageFailed(false), [layer, site]);
  const run = async (
    label: string,
    action: (signal: AbortSignal) => Promise<void>,
  ) => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    const id = ++requestId.current;
    setBusy(label);
    setError('');
    try {
      await action(controller.signal);
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : 'Lookup unavailable.');
    } finally {
      if (id === requestId.current) setBusy('');
    }
  };
  const search = (query = address) => {
    const value = query.trim();
    if (value.length < 5) {
      setError('Enter a full street address.');
      return;
    }
    setAddress(value);
    setMatches([]);
    setParcels([]);
    setMatched(null);
    setSite(null);
    setSearched(false);
    run('Finding address', async (signal) => {
      const d = await requestData(
        '/api/site-search',
        { address: value },
        signal,
      );
      if (signal.aborted) return;
      setMatches(d.matches);
      setSearched(true);
    });
  };
  const findParcels = (match: AddressMatch) => {
    setMatched(match);
    setParcels([]);
    setSite(null);
    run('Finding nearby parcels', async (signal) => {
      const d = await requestData(
        '/api/site-parcels',
        { lon: match.lon, lat: match.lat },
        signal,
      );
      if (signal.aborted) return;
      setParcels(d.parcels);
      setTruncated(d.truncated);
      if (!d.parcels.length)
        setError(
          'No mapped parcel was found near this address. Try another address or use the county map.',
        );
    });
  };
  const assess = (parcel: Parcel) =>
    run('Checking parcel, zoning & terrain', async (signal) => {
      const d = await requestData(
        '/api/site-assessment',
        { parcelId: parcel.id },
        signal,
      );
      if (signal.aborted) return;
      setSite(d);
      setLayer('hillshade');
    });
  const validProfile =
    site?.profile.filter((p) => p.elevationFt !== null) || [];
  const min = validProfile.length
      ? Math.min(...validProfile.map((p) => p.elevationFt!))
      : 0,
    max = validProfile.length
      ? Math.max(...validProfile.map((p) => p.elevationFt!))
      : 0;
  const span = site?.profile.at(-1)?.distanceFt || 1;
  const px = (d: number) => 60 + (d / span) * 790;
  const py = (e: number) => 180 - ((e - min) / Math.max(1, max - min)) * 135;
  let gap = true;
  const profilePath = site?.profile
    .map((p) => {
      if (p.elevationFt === null) {
        gap = true;
        return '';
      }
      const command = gap ? 'M' : 'L';
      gap = false;
      return `${command}${px(p.distanceFt)} ${py(p.elevationFt)}`;
    })
    .join(' ');
  const sources = [
    ...new Set(validProfile.map((p) => p.source).filter(Boolean)),
  ];
  return (
    <section className="site-check">
      <div className="site-check-heading">
        <div>
          <span className="eyebrow">BEFORE THE DESIGN / SITE INTELLIGENCE</span>
          <h2>Start with the land.</h2>
          <p>
            Find the address, confirm the parcel, and understand the ground
            beneath the plan.
          </p>
        </div>
        <span className="status mint">Ventura County pilot</span>
      </div>
      <form
        className="site-address-form"
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
      >
        <MapPin size={20} />
        <Input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          aria-label="Property street address"
          placeholder="Enter a street address in Ojai or Ventura County"
          maxLength={240}
        />
        <Button
          className="primary-action"
          type="submit"
          disabled={!!busy || address.trim().length < 5}
        >
          {busy ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Search size={16} />
          )}{' '}
          {busy || 'Find property'}
        </Button>
      </form>
      <div className="site-search-helper">
        <span>Live county data · Results kept in this session</span>
        <button
          onClick={() => search('401 S Ventura St, Ojai, CA')}
          disabled={!!busy}
        >
          Try Ojai City Hall
        </button>
        <a href={siteSources.parcels} target="_blank" rel="noreferrer">
          County source <ArrowUpRight size={12} />
        </a>
      </div>
      {error && (
        <div className="site-error" role="alert">
          {error}
        </div>
      )}
      {searched && !matches.length && !busy && (
        <div className="empty-state">
          <Search />
          <h3>No address match</h3>
          <p>
            Use a street number, street name, and Ventura County city. Vacant
            land may require a parcel record instead.
          </p>
          <a href={siteSources.parcels} target="_blank" rel="noreferrer">
            Open county parcel source
          </a>
        </div>
      )}
      {!!matches.length && !site && (
        <div className="site-matches">
          <div className="section-label">01 / CONFIRM THE ADDRESS</div>
          {matches.map((m, i) => (
            <button
              key={i}
              disabled={!!busy}
              className={matched === m ? 'chosen' : ''}
              onClick={() => findParcels(m)}
            >
              <MapPin size={17} />
              <span>
                <b>{m.address}</b>
                <small>
                  {m.kind} · Match score {m.score.toFixed(0)} / 100
                </small>
              </span>
              {matched === m ? <Check size={18} /> : <ArrowRight size={18} />}
            </button>
          ))}
        </div>
      )}
      {!!parcels.length && !site && (
        <div className="parcel-candidates">
          <div className="section-label">
            02 / CHECK THE PARCEL OUTLINE & APN
          </div>
          <p>
            An address can point to a building within a larger parcel. These
            candidates are within 70 metres of the address point.
          </p>
          {truncated && (
            <p className="site-error">
              More candidates exist. This list is incomplete; refine the address
              or check the county map.
            </p>
          )}
          <div className="parcel-candidate-grid">
            {parcels.map((p) => (
              <button key={p.id} disabled={!!busy} onClick={() => assess(p)}>
                <svg viewBox="0 0 1200 800" aria-hidden="true">
                  <path
                    d={outline(p)}
                    fill="#b4dca82a"
                    fillRule="evenodd"
                    stroke="#c5daa3"
                    strokeWidth="14"
                  />
                </svg>
                <span>
                  <b>APN {p.apn}</b>
                  <small>
                    {p.situs || 'No situs address in county record'}
                  </small>
                  <strong>
                    {p.acres?.toLocaleString() ?? 'Unknown'} GIS acres{' '}
                    {p.containsAddress ? '· Contains address point' : ''}
                  </strong>
                </span>
                <ArrowRight size={18} />
              </button>
            ))}
          </div>
        </div>
      )}
      {!searched && !busy && !site && (
        <div className="site-start-grid">
          <article>
            <ScanLine />
            <h3>Parcel & planning</h3>
            <p>
              County parcel outlines, mapped acreage, and zoning. Confirm the
              parcel before using the results.
            </p>
          </article>
          <article>
            <Mountain />
            <h3>Terrain & contours</h3>
            <p>
              USGS elevation, five-foot contour mapping, and a cross-section of
              the terrain.
            </p>
          </article>
          <article>
            <ArrowUpRight />
            <h3>Google Maps & GIS</h3>
            <p>
              Open the address in Google Maps and carry the parcel data into
              QGIS.
            </p>
          </article>
        </div>
      )}
      {site && (
        <div className="site-results">
          <div className="site-result-heading">
            <div>
              <span className="eyebrow">
                SELECTED PARCEL /{' '}
                {new Date(site.retrievedAt).toLocaleDateString('en-US')}
              </span>
              <h3>
                {site.parcel.situs ||
                  matched?.address ||
                  `Parcel ${site.parcel.apn}`}
              </h3>
              <p>
                APN {site.parcel.apn} · {site.jurisdiction}
              </p>
            </div>
            <div>
              <Button
                variant="outline"
                onClick={() => {
                  setSite(null);
                  if (matched) findParcels(matched);
                }}
              >
                Change parcel
              </Button>
              <Button className="primary-action" onClick={() => onStart(site)}>
                Start project <ArrowRight size={15} />
              </Button>
            </div>
          </div>
          <div className="site-kpis">
            <div>
              <small>GIS PARCEL AREA</small>
              <strong>
                {site.parcel.acres?.toLocaleString() ?? '—'} <em>acres</em>
              </strong>
              <span>County attribute; not a legal lot determination</span>
            </div>
            <div>
              <small>PLANNING ZONING</small>
              <strong className="zone-value">
                {site.zoning.length
                  ? site.zoning.map((z) => z.ZONE).join(' / ')
                  : site.cities.length
                    ? 'City check needed'
                    : 'Not confirmed'}
              </strong>
              <span>
                {site.zoning.length
                  ? site.zoning.map((z) => z.DEFINITION).join(' / ')
                  : site.cities.length
                    ? 'County map identifies the city, not its zone'
                    : 'Source check still required'}
              </span>
            </div>
            <div>
              <small>LEGAL / BUILDABLE AREA</small>
              <strong>Unverified</strong>
              <span>Depends on use, setbacks, overlays, title & permits</span>
            </div>
          </div>
          {!!site.warnings.length && (
            <div className="site-error">
              {site.warnings.map((w) => (
                <p key={w}>{w}</p>
              ))}
            </div>
          )}
          <div className="site-map-layout">
            <div className="site-map-card">
              <div className="site-map-toolbar">
                <Tabs value={layer} onValueChange={(v) => setLayer(String(v))}>
                  <TabsList>
                    <TabsTrigger value="hillshade">Hillshade</TabsTrigger>
                    <TabsTrigger value="contours">Contours</TabsTrigger>
                    <TabsTrigger value="imagery">Aerial map</TabsTrigger>
                    <TabsTrigger value="google">Google</TabsTrigger>
                  </TabsList>
                </Tabs>
                <label>
                  <Switch
                    checked={profileLine}
                    onCheckedChange={setProfileLine}
                    aria-label="Show terrain profile line"
                  />{' '}
                  Profile line
                </label>
              </div>
              {layer === 'google' ? (
                site.googleEmbedUrl ? (
                  <iframe
                    title="Google satellite map of the selected parcel area"
                    src={site.googleEmbedUrl}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                  />
                ) : (
                  <div className="google-connect">
                    <MapPin size={30} />
                    <h3>Open this location in Google Maps</h3>
                    <p>
                      The in-app Google map is not connected yet. Satellite view
                      is available through the link below.
                    </p>
                    <a
                      className="site-link-button"
                      href={googleMapUrl(
                        matched?.address ||
                          site.parcel.situs ||
                          `${site.profile[8].lat},${site.profile[8].lon}`,
                      )}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open Google Maps <ArrowUpRight size={15} />
                    </a>
                  </div>
                )
              ) : (
                <div className={`site-live-map ${layer}`}>
                  <svg
                    viewBox="0 0 1200 800"
                    aria-label="Live terrain map with county parcel boundary and west to east profile line"
                  >
                    <image
                      href={
                        layer === 'hillshade'
                          ? site.hillshadeUrl
                          : layer === 'contours'
                            ? site.contourUrl
                            : site.imageryUrl
                      }
                      width="1200"
                      height="800"
                      preserveAspectRatio="none"
                      onError={() => setImageFailed(true)}
                    />
                    <path
                      d={outline(site.parcel, site.bounds)}
                      fill="#c0e89712"
                      fillRule="evenodd"
                      stroke={layer === 'contours' ? '#476824' : '#ddf7a4'}
                      strokeWidth="3"
                    />
                    {profileLine && (
                      <g>
                        <path
                          d="M 0 400 H 1200"
                          stroke="#ffdb7a"
                          strokeWidth="3"
                          strokeDasharray="12 8"
                        />
                        <rect
                          x="15"
                          y="359"
                          width="125"
                          height="29"
                          fill="#102419dd"
                        />
                        <text x="29" y="379" fontSize="16" fill="#ffe5a1">
                          A — west
                        </text>
                        <rect
                          x="1060"
                          y="359"
                          width="125"
                          height="29"
                          fill="#102419dd"
                        />
                        <text x="1074" y="379" fontSize="16" fill="#ffe5a1">
                          B — east
                        </text>
                      </g>
                    )}
                  </svg>
                  {imageFailed && (
                    <div className="map-load-error">
                      This map layer did not load. Try another layer or open the
                      source.
                    </div>
                  )}
                  <div className="map-source-label">
                    USGS{' '}
                    {layer === 'imagery'
                      ? 'The National Map · Orthoimagery + topo'
                      : '3DEP elevation'}{' '}
                    · County GIS parcel outline · North ↑
                  </div>
                </div>
              )}
              <div className="site-map-footnote">
                <span>
                  {layer === 'contours'
                    ? '5 ft contour visualization; contour spacing is not a claim of vertical accuracy.'
                    : layer === 'hillshade'
                      ? 'Shaded ground surface derived from elevation data.'
                      : layer === 'imagery'
                        ? 'Public orthoimagery; acquisition date varies and may not reflect current conditions.'
                        : 'Google imagery is separate from the county parcel boundary.'}
                </span>
                <a
                  href={siteSources.elevation}
                  target="_blank"
                  rel="noreferrer"
                >
                  Terrain source <ArrowUpRight size={12} />
                </a>
              </div>
            </div>
            <aside className="site-rules">
              <div className="section-label">WHAT CAN BE DONE HERE?</div>
              <label>
                Proposed work
                <Input
                  value={proposedUse}
                  onChange={(e) => setProposedUse(e.target.value)}
                  maxLength={200}
                  aria-label="Proposed land use"
                />
              </label>
              <div className="rule-state">
                <span>Jurisdiction</span>
                <b>{site.jurisdiction}</b>
              </div>
              <div className="rule-state">
                <span>Mapped overlays</span>
                <b>
                  {!site.sourceStatus.overlays
                    ? 'Unavailable'
                    : site.overlays.length
                      ? site.overlays
                          .map((o) => o.OVERLAY_NA || o.OVERLAY_ZO || o.ZONE)
                          .join(' · ')
                      : 'None returned by this layer'}
                </b>
              </div>
              <div className="rule-state pending">
                <span>Allowed use & setbacks</span>
                <b>Needs ordinance review</b>
              </div>
              <div className="rule-state pending">
                <span>Legal lot, easements & access</span>
                <b>Needs title / parcel records</b>
              </div>
              <div className="rule-state pending">
                <span>Pond, grading & water constraints</span>
                <b>Needs site & agency review</b>
              </div>
              <p>
                A zoning code’s lot-size number is not an allowed building
                footprint. No legal envelope is calculated from imagery alone.
              </p>
              <a
                href={planningAuthority(site)}
                target="_blank"
                rel="noreferrer"
                className="site-link-button"
              >
                Open jurisdiction / planning source <ArrowUpRight size={14} />
              </a>
              <a href={siteSources.legalLot} target="_blank" rel="noreferrer">
                About legal lot status <ArrowUpRight size={13} />
              </a>
            </aside>
          </div>
          <div className="terrain-profile">
            <div className="planning-panel-title">
              <div>
                <span className="eyebrow">A → B / WEST TO EAST</span>
                <h3>Sampled terrain profile</h3>
              </div>
              <span className="status mint">
                {validProfile.length} / {site.profile.length} elevations
                returned
              </span>
            </div>
            {validProfile.length ? (
              <>
                <div className="terrain-profile-metrics">
                  <span>
                    Profile low <b>{min.toFixed(1)} ft</b>
                  </span>
                  <span>
                    Profile high <b>{max.toFixed(1)} ft</b>
                  </span>
                  <span>
                    Profile relief <b>{(max - min).toFixed(1)} ft</b>
                  </span>
                  <span>
                    Transect length <b>{span.toFixed(0)} ft</b>
                  </span>
                </div>
                <svg
                  viewBox="0 0 920 225"
                  role="img"
                  aria-label={`Terrain profile: ${min.toFixed(1)} to ${max.toFixed(1)} feet above source vertical datum.`}
                >
                  {[0, 0.5, 1].map((f) => (
                    <g key={f}>
                      <line
                        x1="60"
                        x2="850"
                        y1={py(min + (max - min) * f)}
                        y2={py(min + (max - min) * f)}
                        stroke="#c5d0ba"
                        strokeDasharray="4 5"
                      />
                      <text
                        x="50"
                        y={py(min + (max - min) * f) + 4}
                        textAnchor="end"
                        fill="#566c4d"
                        fontSize="12"
                      >
                        {(min + (max - min) * f).toFixed(0)} ft
                      </text>
                    </g>
                  ))}
                  <path
                    d={profilePath}
                    fill="none"
                    stroke="#476a38"
                    strokeWidth="3"
                  />
                  {site.profile
                    .filter((p) => p.elevationFt !== null)
                    .map((p, i) => (
                      <circle
                        key={i}
                        cx={px(p.distanceFt)}
                        cy={py(p.elevationFt!)}
                        r="3"
                        fill="#476a38"
                      />
                    ))}
                  <text x="60" y="209" fill="#566c4d" fontSize="13">
                    A · west
                  </text>
                  <text
                    x="850"
                    y="209"
                    textAnchor="end"
                    fill="#566c4d"
                    fontSize="13"
                  >
                    B · east
                  </text>
                </svg>
              </>
            ) : (
              <p className="planning-note">
                Elevation data is currently unavailable. Try the lookup again
                later.
              </p>
            )}
            <p className="planning-note">
              The line crosses the map window, including land outside the
              parcel. These are sampled profile extrema, not whole-property
              extrema or a drainage design. {sources.join(' · ')}
              {validProfile[0]?.acquired
                ? ` · Acquired ${validProfile[0].acquired}`
                : ''}
              {validProfile[0]?.resolutionM
                ? ` · ${validProfile[0].resolutionM} m raster resolution (not accuracy)`
                : ''}
              {validProfile[0]?.datum ? ` · ${validProfile[0].datum}` : ''}.
            </p>
          </div>
          <div className="site-gis-handoff">
            <div>
              <span className="eyebrow">OPEN-SOURCE HANDOFF</span>
              <h3>Take the site into QGIS.</h3>
              <p>
                Export the boundary and elevation samples. QGIS and GDAL can
                turn an elevation raster into contours, slope maps, and design
                layers.
              </p>
              <a href={siteSources.qgis} target="_blank" rel="noreferrer">
                QGIS <ArrowUpRight size={13} />
              </a>
              <a href={siteSources.gdal} target="_blank" rel="noreferrer">
                GDAL contour tools <ArrowUpRight size={13} />
              </a>
              <a href="/terrain-workflow.sh" download>
                Download terrain script <Download size={13} />
              </a>
            </div>
            <div className="gis-downloads">
              <a
                className="site-link-button"
                href={demExportUrl(site.bounds)}
                target="_blank"
                rel="noreferrer"
              >
                <Download size={15} /> Elevation GeoTIFF
              </a>
              <Button
                variant="outline"
                onClick={() =>
                  run('Preparing GIS export', async (signal) => {
                    const data = await requestData(
                      '/api/site-export',
                      { parcelId: site.parcel.id },
                      signal,
                    );
                    if (!signal.aborted)
                      download(
                        JSON.stringify(data, null, 2),
                        `parcel-${site.parcel.apn}.geojson`,
                      );
                  })
                }
              >
                <Download size={15} /> Parcel GeoJSON
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  download(
                    'distance_ft,elevation_ft,longitude,latitude\n' +
                      site.profile
                        .map((p) =>
                          [
                            p.distanceFt,
                            p.elevationFt ?? '',
                            p.lon,
                            p.lat,
                          ].join(','),
                        )
                        .join('\n'),
                    `parcel-${site.parcel.apn}-profile.csv`,
                    'text/csv',
                  )
                }
              >
                <Download size={15} /> Profile CSV
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  download(
                    JSON.stringify(
                      {
                        ...site,
                        googleEmbedUrl: undefined,
                        proposedUse,
                        demExport: {
                          url: demExportUrl(site.bounds),
                          elevationUnits: 'metres',
                          horizontalCRS: 'EPSG:32611',
                          rendering: 'None (raw DEM)',
                          note: 'Grid is resampled; retain the accompanying profile source dates, resolution, and vertical datum. No accuracy improvement implied.',
                        },
                        legalBuildableArea: null,
                        legalStatus: 'Not verified',
                      },
                      null,
                      2,
                    ),
                    `parcel-${site.parcel.apn}-site-check.json`,
                  )
                }
              >
                <Download size={15} /> Site source report
              </Button>
            </div>
          </div>
        </div>
      )}
      <div className="site-boundary-note">
        <b>Parcel area is not a development allowance.</b>
        <p>
          Allowed uses, setbacks, easements, grading, watercourses, and permit
          conditions still need a project-specific check.{' '}
          <a href={siteSources.legalLot} target="_blank" rel="noreferrer">
            Ventura County legal lot guidance ↗
          </a>
        </p>
      </div>
    </section>
  );
}
