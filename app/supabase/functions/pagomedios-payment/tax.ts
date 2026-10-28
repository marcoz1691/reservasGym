/**
 * El precio del plan es el total final (IVA incluido). Pagomedios exige
 * amount = amount_with_tax + amount_without_tax + tax_value, con tax_value
 * calculado sobre amount_with_tax; se busca la base cuyo IVA redondeado cuadre al centavo.
 */
export function splitTax(totalCents: number, rate: number) {
  const toMoney = (cents: number) => Number((cents / 100).toFixed(2))
  if (!rate || rate <= 0) {
    return {
      amount: toMoney(totalCents),
      amount_with_tax: 0,
      amount_without_tax: toMoney(totalCents),
      tax_value: 0,
    }
  }
  const guess = Math.round(totalCents / (1 + rate))
  let base = guess
  for (let delta = 0; delta <= 3; delta++) {
    const up = guess + delta
    const down = guess - delta
    if (up + Math.round(up * rate) === totalCents) { base = up; break }
    if (down + Math.round(down * rate) === totalCents) { base = down; break }
  }
  while (base > 0 && base + Math.round(base * rate) > totalCents) base--
  const tax = Math.round(base * rate)
  const withoutTax = Math.max(0, totalCents - base - tax)
  return {
    amount: toMoney(base + tax + withoutTax),
    amount_with_tax: toMoney(base),
    amount_without_tax: toMoney(withoutTax),
    tax_value: toMoney(tax),
  }
}
