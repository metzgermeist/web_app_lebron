import React from "react";

const CARD_BRANDS = [
  { name: "Visa", pattern: /^4/ },
  {
    name: "Mastercard",
    pattern: /^(5[1-5]|222[1-9]|22[3-9]\d|2[3-6]\d{2}|27[0-1]\d|2720)/,
  },
  { name: "American Express", pattern: /^(34|37)/ },
  { name: "Cabal", pattern: /^(5899|6042)/ },
  { name: "Naranja", pattern: /^5896/ },
  { name: "Cordobesa", pattern: /^5895/ },
  { name: "Cencosud", pattern: /^6037/ },
  { name: "CMR", pattern: /^5041/ },
  { name: "Mercado Pago", pattern: /^50(30|41|42)/ },
  { name: "Shopping", pattern: /^6035/ },
  { name: "Maestro", pattern: /^(50|56|57|58|63|67)/ },
  { name: "Diners", pattern: /^(30[0-5]|36|38)/ },
];

function getCardType(number = "") {
  const digits = (number || "").replace(/\D/g, "");
  if (!digits) return "";
  const match = CARD_BRANDS.find((entry) => entry.pattern.test(digits));
  return match ? match.name : "Tarjeta desconocida";
}

export default function CardBrand({ number }) {
  const brand = getCardType(number);
  if (!brand) return null;
  return <span className="card-brand">{brand}</span>;
}
