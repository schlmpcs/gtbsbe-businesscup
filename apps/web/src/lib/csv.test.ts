import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rowsOf, maskLabel, categoryOf, parseStatement } from "./csv";
const csv = (amount: string, date = "2026-02-03", label = "Grocery") =>
  `Date,Description,Amount\n${date},${label},${amount}`;
test("canonical three bank export formats and expense sign conventions", () => {
  const read = (name: string) =>
    readFileSync(`packages/data/fixtures/${name}`, "utf8");
  const sample = parseStatement(read("statement.sample.csv"));
  const signed = parseStatement(
    read("statement.signed-bank.csv"),
    undefined,
    true,
  );
  const debit = parseStatement(read("statement.debit-credit.csv"));
  assert.ok(sample.length > 0);
  assert.ok(signed.length > 0);
  assert.ok(debit.length > 0);
  assert.ok(sample.some((x) => x.amount > 0));
  assert.ok(signed.some((x) => x.amount > 0));
  assert.ok(debit.some((x) => x.amount > 0));
  assert.ok(sample.every((x) => /^\d{4}-\d{2}$/.test(x.month)));
});
test("quoted commas, embedded newlines, escaped quotes and CRLF", () => {
  assert.deepEqual(rowsOf('a,b\r\n"one,two","say ""hello""\nagain"\r\n'), [
    ["a", "b"],
    ["one,two", 'say "hello"\nagain'],
  ]);
  const [item] = parseStatement(
    'Date,Description,Amount\r\n2026-02-03,"Grocery, market","$1,234.50"',
  );
  assert.equal(item.amount, 1234.5);
  assert.equal(item.label, "Grocery, market");
});
test("refunds, accounting negatives, currency and sign reversal", () => {
  assert.equal(parseStatement(csv("-12.50"))[0].amount, -12.5);
  assert.equal(parseStatement(csv("($12.50)"))[0].amount, -12.5);
  assert.equal(parseStatement(csv("+$12.50"))[0].amount, 12.5);
  assert.equal(parseStatement(csv("12.50"), undefined, true)[0].amount, -12.5);
  assert.equal(
    parseStatement("Date,Description,Debit,Credit\n2026-01-01,refund,,25")[0]
      .amount,
    -25,
  );
});
test("reject invalid dates, amounts, missing descriptions and malformed CSV", () => {
  for (const date of [
    "2026-02-29",
    "2026-04-31",
    "2026-13-01",
    "0001-01-01",
    "2026-01-00",
    "02/30/2026",
    "yesterday",
  ])
    assert.throws(() => parseStatement(csv("10", date)));
  assert.equal(parseStatement(csv("10", "2024-02-29"))[0].day, 29);
  for (const amount of [
    "",
    "NaN",
    "Infinity",
    "1e3",
    "0x10",
    "1 23",
    "1.234",
    "--1",
    "1000000000001",
    '"1,23"',
  ])
    assert.throws(() => parseStatement(csv(amount)));
  assert.throws(() => parseStatement(csv("10", "2026-01-01", "")));
  for (const text of ['a,b\n"oops,b', 'a,b\na"oops",b', 'a,b\n"a"x,b'])
    assert.throws(() => rowsOf(text));
  assert.throws(() =>
    parseStatement("Date,Description,Amount\n2026-01-01,Shop"),
  );
  assert.throws(() =>
    parseStatement("Date,Description,Amount\n2026-01-01,Shop,10,extra"),
  );
});
test("mapping validates indices and separate debit/credit ambiguity", () => {
  assert.equal(
    parseStatement("when,who,out\n01/02/2026,Shop,5", {
      date: 0,
      label: 1,
      amount: 2,
    })[0].amount,
    5,
  );
  for (const mapping of [
    { date: 10, label: 1, amount: 2 },
    { date: 0, label: 0, amount: 2 },
    { date: 0, label: 1, amount: NaN },
  ])
    assert.throws(() =>
      parseStatement("Date,Description,Amount\n2026-01-01,Shop,10", mapping),
    );
  for (const amounts of [",", "10,5", "-10,", "0,-5"])
    assert.throws(() =>
      parseStatement(
        `Date,Description,Debit,Credit\n2026-01-01,Shop,${amounts}`,
      ),
    );
});
test("PII masking covers personal transfers, account digits and emails", () => {
  for (const label of [
    "Zelle to Jane Smith",
    "Venmo John Doe",
    "PAYPAL Alice",
    "Cash App Bob",
    "TRANSFER TO SAVINGS 123456",
  ])
    assert.equal(maskLabel(label), "Personal transfer");
  const label = maskLabel("Shop 4111-1111-1111-1111 alice@example.com");
  assert.ok(!label.includes("4111"));
  assert.ok(!label.includes("alice"));
  assert.ok(label.includes("[masked]"));
  assert.equal(maskLabel("a".repeat(120)).length, 100);
  assert.equal(
    parseStatement(csv("10", "2026-01-01", "Zelle Jane Doe"))[0].label,
    "Personal transfer",
  );
});
test("BOM, empty lines and deterministic merchant categories", () => {
  assert.equal(
    parseStatement(
      "\uFEFFDate,Description,Amount\n\n2026-01-01,Netflix,12\n",
    )[0].category,
    "subscriptions",
  );
  assert.equal(categoryOf("Kroger"), "groceries");
  assert.equal(categoryOf("Coffee cafe"), "eatingOut");
  assert.equal(categoryOf("daycare"), "childcare");
});
