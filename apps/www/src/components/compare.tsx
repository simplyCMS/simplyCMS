import { Reveal } from './primitives';

/* Порівняльна матриця: чесна — Shopify отримує свої ✓ там, де заслуговує. */

interface Row {
  crit: string;
  us: [string, 'yes' | 'no' | 'meh'];
  opencart: [string, 'yes' | 'no' | 'meh'];
  woo: [string, 'yes' | 'no' | 'meh'];
  shopify: [string, 'yes' | 'no' | 'meh'];
}

const ROWS: Row[] = [
  {
    crit: 'Built as a store first',
    us: ['✓ commerce-native core', 'yes'],
    opencart: ['✓ but 2010s architecture', 'meh'],
    woo: ['✗ plugin on a blog engine', 'no'],
    shopify: ['✓ SaaS', 'yes'],
  },
  {
    crit: 'Language & rendering',
    us: ['TypeScript · React 19 SSR', 'yes'],
    opencart: ['PHP · Twig templates', 'no'],
    woo: ['PHP · WP themes', 'no'],
    shopify: ['Liquid · closed runtime', 'meh'],
  },
  {
    crit: 'Your store repo',
    us: ['thin assembly, ~8 files', 'yes'],
    opencart: ['full source you patch', 'no'],
    woo: ['WP install + plugin soup', 'no'],
    shopify: ['rented, no repo', 'meh'],
  },
  {
    crit: 'Core updates',
    us: ['pnpm update — pages arrive', 'yes'],
    opencart: ['manual, mind the OCMODs', 'no'],
    woo: ['pray plugins survive', 'no'],
    shopify: ['automatic (their roadmap)', 'meh'],
  },
  {
    crit: 'Extensions',
    us: ['typed npm packages, reviewed SQL', 'yes'],
    opencart: ['zip uploads, file patches', 'no'],
    woo: ['60k plugins, quality lottery', 'meh'],
    shopify: ['app store + revenue share', 'meh'],
  },
  {
    crit: 'Own your data & infra',
    us: ['your Postgres + RLS, self-host', 'yes'],
    opencart: ['yours (your hosting)', 'yes'],
    woo: ['yours (your hosting)', 'yes'],
    shopify: ['theirs — export CSVs', 'no'],
  },
  {
    crit: 'Price of the platform',
    us: ['MIT, $0 forever', 'yes'],
    opencart: ['free + paid modules', 'meh'],
    woo: ['free + hosting + plugins', 'meh'],
    shopify: ['$/mo + per-transaction fees', 'no'],
  },
];

export function CompareSection() {
  return (
    <section className="section" id="compare">
      <div className="container">
        <Reveal className="section-head">
          <p className="section-eyebrow">Compare</p>
          <h2>
            The receipt, <em>itemized</em>
          </h2>
          <p className="lede">
            OpenCart pioneered the model we admire — install, extend, update.
            WooCommerce bolted a shop onto a blog engine. Shopify rents you a
            great one. SimplyCMS is that OpenCart promise, rebuilt on a modern
            stack you own.
          </p>
        </Reveal>

        <div className="compare-layout">
          <Reveal delay={100}>
            <div
              className="receipt"
              role="img"
              aria-label="Receipt: what legacy carts cost you — drift, plugin soup and lock-in — versus SimplyCMS at zero"
            >
              <h3>SIMPLYCMS</h3>
              <p className="sub">HONEST RECEIPT · EST. 2026</p>
              <hr />
              <div className="row strike">
                <span className="item">FORK MAINTENANCE, FOREVER</span>
                <span className="price">− YOUR NIGHTS</span>
              </div>
              <div className="row strike">
                <span className="item">PLUGIN CONFLICT ROULETTE</span>
                <span className="price">− YOUR WEEKENDS</span>
              </div>
              <div className="row strike">
                <span className="item">PLATFORM RENT + TX FEES</span>
                <span className="price">− 2% OF EVERYTHING</span>
              </div>
              <hr />
              <div className="row">
                <span className="item">
                  <b>CORE, 5 NPM PACKAGES</b>
                </span>
                <span className="price">$0.00</span>
              </div>
              <div className="row">
                <span className="item">
                  <b>UPDATES THAT ARRIVE</b>
                </span>
                <span className="price">$0.00</span>
              </div>
              <div className="row">
                <span className="item">
                  <b>YOUR DATA, YOUR INFRA</b>
                </span>
                <span className="price">PRICELESS</span>
              </div>
              <hr />
              <div className="row total">
                <span className="item">TOTAL OWNERSHIP</span>
                <span className="price">YOURS</span>
              </div>
              <p className="fine">LICENSE: MIT · NO KEY REQUIRED</p>
              <div className="barcode" />
              <p className="barcode-num">S I M P L Y C M S · D E V</p>
            </div>
          </Reveal>

          <Reveal delay={180}>
            <div className="compare-table-wrap">
              <table className="compare-table">
                <thead>
                  <tr>
                    <th scope="col"> </th>
                    <th scope="col" className="us">
                      SimplyCMS
                    </th>
                    <th scope="col">OpenCart</th>
                    <th scope="col">WooCommerce</th>
                    <th scope="col">Shopify</th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row) => (
                    <tr key={row.crit}>
                      <td className="crit">{row.crit}</td>
                      <td className={`us ${row.us[1]}`}>{row.us[0]}</td>
                      <td className={row.opencart[1]}>{row.opencart[0]}</td>
                      <td className={row.woo[1]}>{row.woo[0]}</td>
                      <td className={row.shopify[1]}>{row.shopify[0]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="compare-note">
              Honest footnote: Shopify is excellent if renting works for you.
              SimplyCMS is for teams that want the OpenCart ownership model on a
              modern, typed stack.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
