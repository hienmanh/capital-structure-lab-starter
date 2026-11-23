/* Pure AGE capital-structure calculations. This file has no DOM or network code. */
(function (root) {
  "use strict";

  function weightedMean(items, valueKey) {
    return items.reduce((sum, item) => sum + item.probability * item[valueKey], 0);
  }

  function weightedStdDev(items, valueKey, mean) {
    const variance = items.reduce((sum, item) => {
      const diff = item[valueKey] - mean;
      return sum + item.probability * diff * diff;
    }, 0);
    return Math.sqrt(variance);
  }

  function firmScenarios({ debt, assets, interestRate, taxRate, ebitScenarios }) {
    const equity = assets - debt;
    const interest = debt * interestRate;
    const outcomes = ebitScenarios.map(({ probability, ebit }) => {
      const ebt = ebit - interest;
      const taxes = ebt * taxRate;
      const netIncome = ebt - taxes;
      const roe = netIncome / equity;
      const tie = interest === 0 ? null : ebit / interest;
      return { probability, ebit, interest, ebt, taxes, netIncome, roe, tie };
    });
    const expectedRoe = weightedMean(outcomes, "roe");
    const sdRoe = weightedStdDev(outcomes, "roe", expectedRoe);
    const tieOutcomes = outcomes.filter((row) => row.tie !== null);
    const expectedTie = tieOutcomes.length ? weightedMean(tieOutcomes, "tie") : null;
    const sdTie = tieOutcomes.length ? weightedStdDev(tieOutcomes, "tie", expectedTie) : null;
    return {
      debt,
      equity,
      interest,
      outcomes,
      expectedRoe,
      sdRoe,
      cvRoe: expectedRoe === 0 ? null : sdRoe / expectedRoe,
      expectedTie,
      sdTie,
    };
  }

  function cdssScenario({ debt, costOfDebt, costOfEquity, taxRate, ebit, totalAssets, originalShares, originalPrice, managementShare }) {
    const interest = costOfDebt == null ? 0 : debt * costOfDebt;
    const netIncome = (ebit - interest) * (1 - taxRate);

    const sharesRepurchasedAt20 = debt / originalPrice;
    const sharesRemainingAt20 = originalShares - sharesRepurchasedAt20;
    const epsAt20 = netIncome / sharesRemainingAt20;
    const dividendsAt20 = epsAt20;
    const priceAt20 = epsAt20 / costOfEquity;
    const waccBook = (debt / totalAssets) * (costOfDebt || 0) * (1 - taxRate)
      + ((totalAssets - debt) / totalAssets) * costOfEquity;
    const managementShareAt20 = managementShare * originalShares / sharesRemainingAt20;

    const equityValue = netIncome / costOfEquity;
    const firmValue = equityValue + debt;
    const priceAtNewPrice = firmValue / originalShares;
    const sharesRepurchasedAtNewPrice = debt === 0 ? 0 : debt / priceAtNewPrice;
    const sharesRemainingAtNewPrice = originalShares - sharesRepurchasedAtNewPrice;
    const epsAtNewPrice = netIncome / sharesRemainingAtNewPrice;
    const dividendsAtNewPrice = epsAtNewPrice;
    const waccMarket = (debt / firmValue) * (costOfDebt || 0) * (1 - taxRate)
      + (equityValue / firmValue) * costOfEquity;
    const managementShareAtNewPrice = managementShare * originalShares / sharesRemainingAtNewPrice;

    return {
      debt, costOfDebt, costOfEquity, interest, netIncome,
      sharesRepurchasedAt20, sharesRemainingAt20, epsAt20, dividendsAt20,
      tie: interest === 0 ? null : ebit / interest,
      priceAt20, waccBook, managementShareAt20,
      equityValue, firmValue, priceAtNewPrice,
      sharesRepurchasedAtNewPrice, sharesRemainingAtNewPrice,
      epsAtNewPrice, dividendsAtNewPrice, waccMarket, managementShareAtNewPrice,
    };
  }

  root.AGEModel = { cdssScenario, firmScenarios };
})(typeof window !== "undefined" ? window : globalThis);
