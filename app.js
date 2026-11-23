(function () {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const fmt = {
    round(value, digits) {
      if (value == null || !Number.isFinite(value)) return null;
      const scale = 10 ** digits;
      return Math.round(Number((value * scale).toPrecision(12))) / scale;
    },
    money(value) {
      if (value == null || !Number.isFinite(value)) return "n/a";
      return "$" + new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(this.round(value, 0));
    },
    shares(value) {
      if (value == null || !Number.isFinite(value)) return "n/a";
      return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(this.round(value, 2));
    },
    price(value) {
      return value == null ? "n/a" : "$" + this.round(value, 2).toFixed(2);
    },
    eps(value) {
      return value == null ? "n/a" : "$" + this.round(value, 2).toFixed(2);
    },
    pct(value) {
      return value == null ? "n/a" : this.round(value * 100, 2).toFixed(2) + "%";
    },
    multiple(value) {
      return value == null ? "n/a" : this.round(value, 2).toFixed(2) + "×";
    },
    cv(value) {
      return value == null ? "n/a" : this.round(value, 2).toFixed(2);
    },
  };

  function parseCsv(text) {
    const [headerLine, ...lines] = text.trim().split(/\r?\n/);
    const headers = headerLine.split(",");
    return lines.filter(Boolean).map((line) => {
      const values = line.split(",");
      return Object.fromEntries(headers.map((key, index) => [key, values[index] ?? ""]));
    });
  }

  async function csv(path) {
    const response = await fetch("./" + path, { cache: "no-cache" });
    if (!response.ok) throw new Error(`Could not load ${path} (${response.status})`);
    return parseCsv(await response.text());
  }

  const byItem = (rows, key = "item") => Object.fromEntries(rows.map((row) => [row[key], Number(row.value)]));
  const fmtDebt = (value) => fmt.money(value);
  const percentTag = (value) => fmt.pct(value);
  const cell = (label, value, className = "") => `<td data-label="${label}" class="${className}">${value}</td>`;

  function table(headers, rows, className = "") {
    return `<table class="data-table ${className}"><thead><tr>${headers.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>`;
  }

  function scenarioClass(value, selected) {
    return Number(value) === Number(selected) ? "is-selected" : "";
  }

  function renderCaseTable(scenarios, selectedDebt) {
    const rows = scenarios.map((s) => `<tr class="${scenarioClass(s.debt, selectedDebt)}">${[
      cell("Debt", fmtDebt(s.debt), "bold-cell"),
      cell("Interest", fmt.money(s.interest)),
      cell("Net income", fmt.money(s.netIncome)),
      cell("Shares repurchased", fmt.shares(s.sharesRepurchasedAt20)),
      cell("Shares remaining", fmt.shares(s.sharesRemainingAt20)),
      cell("EPS", fmt.eps(s.epsAt20)),
      cell("Dividends per share", fmt.eps(s.dividendsAt20)),
      cell("TIE", fmt.multiple(s.tie)),
      cell("Share price", fmt.price(s.priceAt20), "highlight-cell"),
      cell("WACC · book", percentTag(s.waccBook)),
      cell("Management share", percentTag(s.managementShareAt20)),
    ].join("")}</tr>`);
    $("#case-table").innerHTML = table(["Debt", "Interest", "Net income", "Shares repurchased", "Shares remaining", "EPS", "Dividends / share", "TIE", "Share price", "WACC · book", "Management share"], rows);
  }

  function renderMarketTable(scenarios, selectedDebt) {
    const rows = scenarios.map((s) => `<tr class="${scenarioClass(s.debt, selectedDebt)}">${[
      cell("Debt", fmtDebt(s.debt), "bold-cell"),
      cell("Equity value S", fmt.money(s.equityValue)),
      cell("Firm value V", fmt.money(s.firmValue)),
      cell("Share price", fmt.price(s.priceAtNewPrice), "highlight-cell"),
      cell("Shares repurchased", fmt.shares(s.sharesRepurchasedAtNewPrice)),
      cell("Shares remaining", fmt.shares(s.sharesRemainingAtNewPrice)),
      cell("EPS", fmt.eps(s.epsAtNewPrice)),
      cell("Dividends per share", fmt.eps(s.dividendsAtNewPrice)),
      cell("TIE", fmt.multiple(s.tie)),
      cell("WACC · market", percentTag(s.waccMarket)),
      cell("Management · new price", percentTag(s.managementShareAtNewPrice)),
      cell("Management · $20", percentTag(s.managementShareAt20)),
      cell("WACC · book", percentTag(s.waccBook)),
    ].join("")}</tr>`);
    $("#market-table").innerHTML = table(["Debt", "Equity value S", "Firm value V", "Share price", "Shares repurchased", "Shares remaining", "EPS", "Dividends / share", "TIE", "WACC · market", "Management · new price", "Management · $20", "WACC · book"], rows);
  }

  function renderFirmTable(rows, selectedDebt) {
    const html = rows.map((s) => `<tr class="${scenarioClass(s.debt, selectedDebt)}">${[
      cell("Firm L debt", fmtDebt(s.debt), "bold-cell"),
      cell("Expected ROE", fmt.pct(s.expectedRoe)),
      cell("σ(ROE)", fmt.pct(s.sdRoe)),
      cell("CV(ROE)", fmt.cv(s.cvRoe)),
      cell("Expected TIE", fmt.multiple(s.expectedTie)),
      cell("σ(TIE)", fmt.multiple(s.sdTie)),
    ].join("")}</tr>`);
    $("#firm-table").innerHTML = table(["Firm L debt", "Expected ROE", "σ(ROE)", "CV(ROE)", "Expected TIE", "σ(TIE)"], html);
  }

  function renderActiveSummary(scenario, bestPrice, highestEps, firm, firmOutcomes, basePrice, casePrice) {
    const items = [
      ["Share price · $20 buyback", fmt.price(scenario.priceAt20)],
      ["Share price · new price", fmt.price(scenario.priceAtNewPrice)],
      ["EPS · $20 buyback", fmt.eps(scenario.epsAt20)],
      ["Dividends / share · $20", fmt.eps(scenario.dividendsAt20)],
      ["Dividends / share · new price", fmt.eps(scenario.dividendsAtNewPrice)],
      ["WACC · book weights", fmt.pct(scenario.waccBook)],
      ["TIE", fmt.multiple(scenario.tie)],
      ["Management share · $20", fmt.pct(scenario.managementShareAt20)],
    ];
    $("#active-summary").innerHTML = items.map(([label, value], i) => `<div class="metric-card ${i < 2 ? "metric-primary" : ""}"><span>${label}</span><strong>${value}</strong></div>`).join("");
    const note = scenario.debt === bestPrice.debt && scenario.debt === highestEps.debt
      ? `At ${fmtDebt(scenario.debt)}, the share-price and EPS maxima coincide.`
      : scenario.debt === bestPrice.debt
        ? `Best-price choice: ${fmtDebt(bestPrice.debt)}. Highest EPS occurs at ${fmtDebt(highestEps.debt)}.`
        : scenario.debt === highestEps.debt
          ? `Highest-EPS choice: ${fmtDebt(highestEps.debt)}. Best share price occurs at ${fmtDebt(bestPrice.debt)}.`
          : `Best share price: ${fmtDebt(bestPrice.debt)}. Highest EPS: ${fmtDebt(highestEps.debt)}.`;
    const ownershipNote = scenario.managementShareAt20 === 1 ? " The $20 buyback would leave no outside shareholders." : "";
    $("#selection-note").textContent = note + ownershipNote;
    const priceIdentity = Math.abs(scenario.epsAtNewPrice - scenario.costOfEquity * scenario.priceAtNewPrice) < 1e-9;
    const baseIdentity = Math.abs(basePrice.priceAt20 - casePrice) < 1e-9;
    const modelCheck = `${baseIdentity ? `At $0 debt, EPS / cost of equity returns the current ${fmt.price(casePrice)} price.` : "The $0-debt price does not match case data."} ${priceIdentity ? `New-price check: ${fmt.eps(scenario.epsAtNewPrice)} EPS = ${fmt.pct(scenario.costOfEquity)} × ${fmt.price(scenario.priceAtNewPrice)}.` : "The new-price EPS check did not reconcile."}`;
    $("#model-check").textContent = modelCheck;
    const firmText = `At ${fmtDebt(firm.debt)}, Firm L has expected ROE ${fmt.pct(firm.expectedRoe)}, σ(ROE) ${fmt.pct(firm.sdRoe)}, CV ${fmt.cv(firm.cvRoe)}, and expected TIE ${fmt.multiple(firm.expectedTie)}.`;
    $("#firm-compare").innerHTML = `<div class="compare-card"><span>Firm U · no debt</span><strong>Expected ROE ${fmt.pct(0.09)}</strong><small>σ(ROE) ${fmt.pct(Math.sqrt(0.00045))} · CV ${fmt.cv(Math.sqrt(0.00045) / 0.09)} · TIE n/a</small></div><div class="compare-card compare-card-selected"><span>Firm L · selected</span><strong>${firmText}</strong><small>Debt interest held at 12% across the slider.</small></div>`;
    const unlevered = firmOutcomes.find((row) => row.debt === 0);
    const outcomeRows = firm.outcomes.map((outcome, index) => {
      const unleveredOutcome = unlevered.outcomes[index];
      return `<tr>${[
        cell("Probability", percentTag(outcome.probability)),
        cell("EBIT", fmt.money(outcome.ebit)),
        cell("Firm U interest", fmt.money(unleveredOutcome.interest)),
        cell("Firm U EBT", fmt.money(unleveredOutcome.ebt)),
        cell("Firm U taxes", fmt.money(unleveredOutcome.taxes)),
        cell("Firm U net income", fmt.money(unleveredOutcome.netIncome)),
        cell("Firm U ROE", fmt.pct(unleveredOutcome.roe)),
        cell("Firm U TIE", fmt.multiple(unleveredOutcome.tie)),
        cell("Firm L interest", fmt.money(outcome.interest)),
        cell("Firm L EBT", fmt.money(outcome.ebt)),
        cell("Firm L taxes", fmt.money(outcome.taxes)),
        cell("Firm L net income", fmt.money(outcome.netIncome)),
        cell("Firm L ROE", fmt.pct(outcome.roe)),
        cell("Firm L TIE", fmt.multiple(outcome.tie)),
      ].join("")}</tr>`;
    });
    $("#firm-outcome-table").innerHTML = `<h3 class="table-subtitle">Question c scenario statements at selected Firm L debt</h3>${table(["Probability", "EBIT", "Firm U interest", "Firm U EBT", "Firm U taxes", "Firm U net income", "Firm U ROE", "Firm U TIE", "Firm L interest", "Firm L EBT", "Firm L taxes", "Firm L net income", "Firm L ROE", "Firm L TIE"], outcomeRows)}`;
  }

  async function init() {
    try {
      const [cdssRows, assumptionRows, bankRows, firmRows, ebitRows] = await Promise.all([
        csv("data/cdss.csv"), csv("data/assumptions.csv"), csv("data/banker_schedule.csv"),
        csv("data/example_firms.csv"), csv("data/ebit_scenarios.csv"),
      ]);
      const cdss = {};
      cdssRows.forEach((row) => { cdss[row.item] = Number(row.value); });
      const assumptions = byItem(assumptionRows, "assumption");
      const firmData = byItem(firmRows);
      const schedule = bankRows.map((row) => ({
        debt: Number(row.debt),
        costOfDebt: row.cost_of_debt === "" ? null : Number(row.cost_of_debt),
        costOfEquity: Number(row.cost_of_equity),
      }));
      const ebitScenarios = ebitRows.map((row) => ({
        probability: Number(row.probability),
        ebit: Number(row.sales) - Number(row.operating_costs),
      }));
      const ebit = cdss.sales * (1 - cdss.variable_cost_rate) - cdss.fixed_costs;
      const cdssScenarios = schedule.map((row) => AGEModel.cdssScenario({
        ...row,
        taxRate: assumptions.tax_rate,
        ebit,
        totalAssets: cdss.total_assets,
        originalShares: cdss.shares_outstanding,
        originalPrice: cdss.share_price,
        managementShare: cdss.management_share,
      }));
      const firmScenarios = [];
      for (let debt = 0; debt <= firmData.slider_max; debt += firmData.slider_step) {
        firmScenarios.push(AGEModel.firmScenarios({
          debt,
          assets: firmData.total_assets,
          interestRate: firmData.interest_rate,
          taxRate: assumptions.tax_rate,
          ebitScenarios,
        }));
      }
      const bestPrice = cdssScenarios.reduce((best, row) => row.priceAt20 > best.priceAt20 ? row : best, cdssScenarios[0]);
      const highestEps = cdssScenarios.reduce((best, row) => row.epsAt20 > best.epsAt20 ? row : best, cdssScenarios[0]);
      const zeroDebt = cdssScenarios[0];
      const basePriceCheck = Math.abs(zeroDebt.priceAt20 - cdss.share_price) < 1e-9;

      const debtSlider = $("#debt-slider");
      const firmSlider = $("#firm-l-slider");
      debtSlider.max = String(schedule.length - 1);
      debtSlider.value = "0";
      debtSlider.disabled = false;
      firmSlider.max = String(firmData.slider_max);
      firmSlider.step = String(firmData.slider_step);
      firmSlider.value = String(firmData.firm_l_debt);
      firmSlider.disabled = false;
      $("#debt-range-max").textContent = fmtDebt(schedule[schedule.length - 1].debt);
      $("#firm-range-max").textContent = fmtDebt(firmData.slider_max);
      $("#load-status").textContent = "Case data loaded";
      $("#load-status").classList.add("status-ready");
      ["#best-price-button", "#highest-eps-button", "#case-button"].forEach((id) => { $(id).disabled = false; });

      function update() {
        const selected = schedule[Number(debtSlider.value)];
        const selectedScenario = cdssScenarios.find((row) => row.debt === selected.debt);
        const selectedFirmDebt = Number(firmSlider.value);
        const selectedFirm = firmScenarios.find((row) => row.debt === selectedFirmDebt);
        $("#debt-value").textContent = fmtDebt(selected.debt);
        $("#firm-l-value").textContent = fmtDebt(selectedFirmDebt);
        renderActiveSummary(selectedScenario, bestPrice, highestEps, selectedFirm, firmScenarios, zeroDebt, cdss.share_price);
        renderCaseTable(cdssScenarios, selected.debt);
        renderMarketTable(cdssScenarios, selected.debt);
        renderFirmTable(firmScenarios, selectedFirmDebt);
      }

      debtSlider.addEventListener("input", update);
      firmSlider.addEventListener("input", update);
      $("#best-price-button").addEventListener("click", () => {
        debtSlider.value = String(schedule.findIndex((row) => row.debt === bestPrice.debt));
        update();
      });
      $("#highest-eps-button").addEventListener("click", () => {
        debtSlider.value = String(schedule.findIndex((row) => row.debt === highestEps.debt));
        update();
      });
      $("#case-button").addEventListener("click", () => {
        firmSlider.value = String(firmData.firm_l_debt);
        update();
      });

      update();
      if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
        navigator.serviceWorker.register("./sw.js").catch(() => {});
      }
    } catch (error) {
      $("#load-status").textContent = "Could not load case data";
      $("#load-status").classList.add("status-error");
      $("#selection-note").textContent = error.message;
    }
  }

  init();
})();
