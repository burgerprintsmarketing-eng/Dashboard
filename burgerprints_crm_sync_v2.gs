/**
 * BurgerPrints CRM V2
 * Nguồn: Google Form có cấu trúc giống file "Quy trình CRM_MKT Qualified Leads_Thông tin Qualified Leads.csv"
 * Cải tiến:
 * 1) Không dùng "Sales tiếp nhận"
 * 2) Theo dõi CAC / ROAS / LTV (và Revenue nếu có)
 * 3) Chuẩn hoá lifecycle stage để dashboard theo dõi vòng đời khách hàng
 */

const CRM_DASHBOARD_SHEET = "dashboard_data";
const CRM_RAW_SHEET = "CRM_RAW";

const CRM_HEADERS = [
  "lead_id",
  "phone",
  "customer_id",
  "full_name",
  "email",
  "facebook",
  "lead_source",
  "content",
  "service_interest",
  "sales_status",
  "consulting_status",
  "potential_rating",
  "products",
  "platforms",
  "market",
  "note",
  "last_contact",
  "conversion",
  "date_lead_created",
  "days_to_convert",
  "lead_classification",
  "paid_date",
  "sales_status_final",
  "barrier",
  "lead_owner",
  "assign_am",
  "cac_usd",
  "roas",
  "ltv_usd",
  "revenue_usd",
  "lifecycle_stage",
  "customer_key",
];

function setupDashboardSheetCRM() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(CRM_DASHBOARD_SHEET);
  if (!sh) sh = ss.insertSheet(CRM_DASHBOARD_SHEET);
  sh.clear();
  sh.getRange(1, 1, 1, CRM_HEADERS.length).setValues([CRM_HEADERS]);
  sh.setFrozenRows(1);
}

function pickValue(namedValues, keys, fallback) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(namedValues, key)) {
      const arr = namedValues[key];
      if (Array.isArray(arr) && arr.length > 0) return String(arr[0] || "").trim();
    }
  }
  return fallback || "";
}

function normalizeDateString(input) {
  if (!input) return "";
  const raw = String(input).trim();
  if (!raw) return "";

  // yyyy/mm/dd hoặc yyyy-mm-dd
  let m = raw.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (m) {
    const yyyy = m[1];
    const mm = String(m[2]).padStart(2, "0");
    const dd = String(m[3]).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  // dd/mm/yyyy
  m = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (m) {
    const dd = String(m[1]).padStart(2, "0");
    const mm = String(m[2]).padStart(2, "0");
    const yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  // fallback theo Date parser
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  return raw;
}

function normalizeMultiValue(input) {
  if (!input) return "";
  return String(input)
    .replace(/\r?\n/g, ",")
    .split(/[;,|]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .join("|");
}

function deriveLifecycleStage(conversion, paidDate, leadClassification, consultingStatus) {
  const conv = String(conversion || "").toLowerCase();
  const leadClass = String(leadClassification || "").toLowerCase();
  const consult = String(consultingStatus || "").trim();

  if (conv.includes("paid") || paidDate) return "Paid";
  if (leadClass.includes("sql")) return "SQL";
  if (consult) return "Contacted";
  return "Lead";
}

function buildCustomerKey(customerId, phone, email, leadId) {
  const c = String(customerId || "").trim();
  const p = String(phone || "").trim();
  const e = String(email || "").trim();
  const l = String(leadId || "").trim();
  return c || p || e || l;
}

/**
 * Trigger: Installable trigger -> On form submit
 */
function onFormSubmitCRM(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CRM_DASHBOARD_SHEET);
  if (!sh) throw new Error("Thiếu sheet dashboard_data. Chạy setupDashboardSheetCRM() trước.");

  const v = e.namedValues || {};

  const leadId = pickValue(v, ["Lead ID"]);
  const phone = pickValue(v, ["SĐT"]);
  const customerId = pickValue(v, ["Customer ID"]);
  const fullName = pickValue(v, ["Họ và Tên"]);
  const email = pickValue(v, ["Email"]);
  const facebook = pickValue(v, ["Facebook"]);
  const leadSource = pickValue(v, ["Nguồn Leads"]);
  const content = pickValue(v, ["Content"]);
  const serviceInterest = pickValue(v, ["Dịch vụ quan tâm"]);
  const salesStatus = pickValue(v, ["Tình trạng bán"]);
  const consultingStatus = pickValue(v, ["Trạng thái tư vấn"]);
  const potentialRating = pickValue(v, ["Đánh giá tiềm năng"]);
  const products = normalizeMultiValue(pickValue(v, ["Sản phẩm FF"]));
  const platforms = normalizeMultiValue(pickValue(v, ["Nền tảng"]));
  const market = pickValue(v, ["Thị trường FF"]);
  const note = pickValue(v, ["Note"]);
  const lastContact = normalizeDateString(pickValue(v, ["Last-time contact"]));
  const conversion = pickValue(v, ["Conversion"]);
  const createdDate = normalizeDateString(pickValue(v, ["Date Lead Created"]));
  const daysToConvert = pickValue(v, ["Số ngày chuyển đổi"]);
  const leadClassification = pickValue(v, ["Phân loại lead"]);
  const paidDate = normalizeDateString(pickValue(v, ["Ngày chuyển đổi Paid"]));
  const salesStatusFinal = pickValue(v, ["Status từ Sales"]);
  const barrier = pickValue(v, ["Rào cản"]);
  const leadOwner = pickValue(v, ["Người tạo Leads"]);
  const assignAm = pickValue(v, ["Assign AM"]);

  // Cột mới để theo dõi hiệu quả tài chính theo từng khách hàng.
  const cacUsd = pickValue(v, ["CAC USD", "CAC (USD)", "CAC"]);
  const roas = pickValue(v, ["ROAS", "ROAS (x)"]);
  const ltvUsd = pickValue(v, ["LTV USD", "LTV (USD)", "LTV"]);
  const revenueUsd = pickValue(v, ["Revenue USD", "Doanh số (USD)"]);

  const lifecycleStage = deriveLifecycleStage(conversion, paidDate, leadClassification, consultingStatus);
  const customerKey = buildCustomerKey(customerId, phone, email, leadId);

  if (!fullName && !customerKey) return;

  sh.appendRow([
    leadId,
    phone,
    customerId,
    fullName,
    email,
    facebook,
    leadSource,
    content,
    serviceInterest,
    salesStatus,
    consultingStatus,
    potentialRating,
    products,
    platforms,
    market,
    note,
    lastContact,
    conversion,
    createdDate,
    daysToConvert,
    leadClassification,
    paidDate,
    salesStatusFinal,
    barrier,
    leadOwner,
    assignAm,
    cacUsd,
    roas,
    ltvUsd,
    revenueUsd,
    lifecycleStage,
    customerKey,
  ]);
}

/**
 * Backfill toàn bộ từ "Form Responses 1" vào "dashboard_data"
 */
function backfillFromFormResponsesCRM() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const source = ss.getSheetByName("Form Responses 1");
  const target = ss.getSheetByName(CRM_DASHBOARD_SHEET);
  if (!source) throw new Error("Không tìm thấy sheet Form Responses 1.");
  if (!target) throw new Error("Không tìm thấy sheet dashboard_data.");

  const data = source.getDataRange().getValues();
  if (data.length < 2) return;

  const headers = data[0].map((h) => String(h).trim());
  const rows = data.slice(1);

  const idx = (names) => {
    for (const n of names) {
      const i = headers.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };

  const iLeadId = idx(["Lead ID"]);
  const iPhone = idx(["SĐT"]);
  const iCustomerId = idx(["Customer ID"]);
  const iFullName = idx(["Họ và Tên"]);
  const iEmail = idx(["Email"]);
  const iFacebook = idx(["Facebook"]);
  const iLeadSource = idx(["Nguồn Leads"]);
  const iContent = idx(["Content"]);
  const iService = idx(["Dịch vụ quan tâm"]);
  const iSaleStatus = idx(["Tình trạng bán"]);
  const iConsult = idx(["Trạng thái tư vấn"]);
  const iPotential = idx(["Đánh giá tiềm năng"]);
  const iProducts = idx(["Sản phẩm FF"]);
  const iPlatforms = idx(["Nền tảng"]);
  const iMarket = idx(["Thị trường FF"]);
  const iNote = idx(["Note"]);
  const iLastContact = idx(["Last-time contact"]);
  const iConversion = idx(["Conversion"]);
  const iCreatedDate = idx(["Date Lead Created"]);
  const iDaysToConvert = idx(["Số ngày chuyển đổi"]);
  const iLeadClass = idx(["Phân loại lead"]);
  const iPaidDate = idx(["Ngày chuyển đổi Paid"]);
  const iStatusFromSales = idx(["Status từ Sales"]);
  const iBarrier = idx(["Rào cản"]);
  const iLeadOwner = idx(["Người tạo Leads"]);
  const iAssignAM = idx(["Assign AM"]);

  const iCac = idx(["CAC USD", "CAC (USD)", "CAC"]);
  const iRoas = idx(["ROAS", "ROAS (x)"]);
  const iLtv = idx(["LTV USD", "LTV (USD)", "LTV"]);
  const iRevenue = idx(["Revenue USD", "Doanh số (USD)"]);

  const output = [];
  for (const r of rows) {
    const leadId = iLeadId >= 0 ? String(r[iLeadId] || "").trim() : "";
    const phone = iPhone >= 0 ? String(r[iPhone] || "").trim() : "";
    const customerId = iCustomerId >= 0 ? String(r[iCustomerId] || "").trim() : "";
    const fullName = iFullName >= 0 ? String(r[iFullName] || "").trim() : "";
    const email = iEmail >= 0 ? String(r[iEmail] || "").trim() : "";
    const customerKey = buildCustomerKey(customerId, phone, email, leadId);
    if (!fullName && !customerKey) continue;

    const conversion = iConversion >= 0 ? String(r[iConversion] || "").trim() : "";
    const paidDate = normalizeDateString(iPaidDate >= 0 ? r[iPaidDate] : "");
    const leadClassification = iLeadClass >= 0 ? String(r[iLeadClass] || "").trim() : "";
    const consultingStatus = iConsult >= 0 ? String(r[iConsult] || "").trim() : "";
    const lifecycleStage = deriveLifecycleStage(conversion, paidDate, leadClassification, consultingStatus);

    output.push([
      leadId,
      phone,
      customerId,
      fullName,
      email,
      iFacebook >= 0 ? String(r[iFacebook] || "").trim() : "",
      iLeadSource >= 0 ? String(r[iLeadSource] || "").trim() : "",
      iContent >= 0 ? String(r[iContent] || "").trim() : "",
      iService >= 0 ? String(r[iService] || "").trim() : "",
      iSaleStatus >= 0 ? String(r[iSaleStatus] || "").trim() : "",
      consultingStatus,
      iPotential >= 0 ? String(r[iPotential] || "").trim() : "",
      normalizeMultiValue(iProducts >= 0 ? r[iProducts] : ""),
      normalizeMultiValue(iPlatforms >= 0 ? r[iPlatforms] : ""),
      iMarket >= 0 ? String(r[iMarket] || "").trim() : "",
      iNote >= 0 ? String(r[iNote] || "").trim() : "",
      normalizeDateString(iLastContact >= 0 ? r[iLastContact] : ""),
      conversion,
      normalizeDateString(iCreatedDate >= 0 ? r[iCreatedDate] : ""),
      iDaysToConvert >= 0 ? r[iDaysToConvert] : "",
      leadClassification,
      paidDate,
      iStatusFromSales >= 0 ? String(r[iStatusFromSales] || "").trim() : "",
      iBarrier >= 0 ? String(r[iBarrier] || "").trim() : "",
      iLeadOwner >= 0 ? String(r[iLeadOwner] || "").trim() : "",
      iAssignAM >= 0 ? String(r[iAssignAM] || "").trim() : "",
      iCac >= 0 ? r[iCac] : "",
      iRoas >= 0 ? r[iRoas] : "",
      iLtv >= 0 ? r[iLtv] : "",
      iRevenue >= 0 ? r[iRevenue] : "",
      lifecycleStage,
      customerKey,
    ]);
  }

  target.clear();
  target.getRange(1, 1, 1, CRM_HEADERS.length).setValues([CRM_HEADERS]);
  target.setFrozenRows(1);
  if (output.length) {
    target.getRange(2, 1, output.length, CRM_HEADERS.length).setValues(output);
  }
}

/**
 * Dành cho case copy/paste data thật vào Google Sheet.
 * Bạn paste raw data vào sheet CRM_RAW (header theo file CSV gốc),
 * hàm này sẽ chuẩn hoá và sync sang dashboard_data.
 */
function syncRawSheetToDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const source = ss.getSheetByName(CRM_RAW_SHEET);
  const target = ss.getSheetByName(CRM_DASHBOARD_SHEET);
  if (!source) throw new Error("Không tìm thấy sheet CRM_RAW.");
  if (!target) throw new Error("Không tìm thấy sheet dashboard_data.");

  const data = source.getDataRange().getValues();
  if (data.length < 2) {
    target.clear();
    target.getRange(1, 1, 1, CRM_HEADERS.length).setValues([CRM_HEADERS]);
    target.setFrozenRows(1);
    return;
  }

  const headers = data[0].map((h) => String(h).trim());
  const rows = data.slice(1);

  const idx = (names) => {
    for (const n of names) {
      const i = headers.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };

  const iLeadId = idx(["Lead ID", "lead_id"]);
  const iPhone = idx(["SĐT", "phone"]);
  const iCustomerId = idx(["Customer ID", "customer_id"]);
  const iFullName = idx(["Họ và Tên", "full_name"]);
  const iEmail = idx(["Email", "email"]);
  const iFacebook = idx(["Facebook", "facebook"]);
  const iLeadSource = idx(["Nguồn Leads", "lead_source"]);
  const iContent = idx(["Content", "content"]);
  const iService = idx(["Dịch vụ quan tâm", "service_interest"]);
  const iSaleStatus = idx(["Tình trạng bán", "sales_status"]);
  const iConsult = idx(["Trạng thái tư vấn", "consulting_status", "consulting_stat", "consulting_sta"]);
  const iPotential = idx(["Đánh giá tiềm năng", "potential_rating"]);
  const iProducts = idx(["Sản phẩm FF", "products"]);
  const iPlatforms = idx(["Nền tảng", "platforms"]);
  const iMarket = idx(["Thị trường FF", "market"]);
  const iNote = idx(["Note", "note"]);
  const iLastContact = idx(["Last-time contact", "last_contact"]);
  const iConversion = idx(["Conversion", "conversion"]);
  const iCreatedDate = idx(["Date Lead Created", "date_lead_created"]);
  const iDaysToConvert = idx(["Số ngày chuyển đổi", "days_to_convert"]);
  const iLeadClass = idx(["Phân loại lead", "lead_classification"]);
  const iPaidDate = idx(["Ngày chuyển đổi Paid", "paid_date"]);
  const iStatusFromSales = idx(["Status từ Sales", "sales_status_final"]);
  const iBarrier = idx(["Rào cản", "barrier"]);
  const iLeadOwner = idx(["Người tạo Leads", "lead_owner"]);
  const iAssignAM = idx(["Assign AM", "assign_am"]);
  const iCac = idx(["CAC USD", "CAC (USD)", "CAC", "cac_usd"]);
  const iRoas = idx(["ROAS", "ROAS (x)", "roas"]);
  const iLtv = idx(["LTV USD", "LTV (USD)", "LTV", "ltv_usd"]);
  const iRevenue = idx(["Revenue USD", "Doanh số (USD)", "revenue_usd"]);

  const output = [];
  for (const r of rows) {
    const leadId = iLeadId >= 0 ? String(r[iLeadId] || "").trim() : "";
    const phone = iPhone >= 0 ? String(r[iPhone] || "").trim() : "";
    const customerId = iCustomerId >= 0 ? String(r[iCustomerId] || "").trim() : "";
    const fullName = iFullName >= 0 ? String(r[iFullName] || "").trim() : "";
    const email = iEmail >= 0 ? String(r[iEmail] || "").trim() : "";
    const customerKey = buildCustomerKey(customerId, phone, email, leadId);
    if (!fullName && !customerKey) continue;

    const conversion = iConversion >= 0 ? String(r[iConversion] || "").trim() : "";
    const paidDate = normalizeDateString(iPaidDate >= 0 ? r[iPaidDate] : "");
    const leadClassification = iLeadClass >= 0 ? String(r[iLeadClass] || "").trim() : "";
    const consultingStatus = iConsult >= 0 ? String(r[iConsult] || "").trim() : "";
    const lifecycleStage = deriveLifecycleStage(conversion, paidDate, leadClassification, consultingStatus);

    output.push([
      leadId,
      phone,
      customerId,
      fullName,
      email,
      iFacebook >= 0 ? String(r[iFacebook] || "").trim() : "",
      iLeadSource >= 0 ? String(r[iLeadSource] || "").trim() : "",
      iContent >= 0 ? String(r[iContent] || "").trim() : "",
      iService >= 0 ? String(r[iService] || "").trim() : "",
      iSaleStatus >= 0 ? String(r[iSaleStatus] || "").trim() : "",
      consultingStatus,
      iPotential >= 0 ? String(r[iPotential] || "").trim() : "",
      normalizeMultiValue(iProducts >= 0 ? r[iProducts] : ""),
      normalizeMultiValue(iPlatforms >= 0 ? r[iPlatforms] : ""),
      iMarket >= 0 ? String(r[iMarket] || "").trim() : "",
      iNote >= 0 ? String(r[iNote] || "").trim() : "",
      normalizeDateString(iLastContact >= 0 ? r[iLastContact] : ""),
      conversion,
      normalizeDateString(iCreatedDate >= 0 ? r[iCreatedDate] : ""),
      iDaysToConvert >= 0 ? r[iDaysToConvert] : "",
      leadClassification,
      paidDate,
      iStatusFromSales >= 0 ? String(r[iStatusFromSales] || "").trim() : "",
      iBarrier >= 0 ? String(r[iBarrier] || "").trim() : "",
      iLeadOwner >= 0 ? String(r[iLeadOwner] || "").trim() : "",
      iAssignAM >= 0 ? String(r[iAssignAM] || "").trim() : "",
      iCac >= 0 ? r[iCac] : "",
      iRoas >= 0 ? r[iRoas] : "",
      iLtv >= 0 ? r[iLtv] : "",
      iRevenue >= 0 ? r[iRevenue] : "",
      lifecycleStage,
      customerKey,
    ]);
  }

  target.clear();
  target.getRange(1, 1, 1, CRM_HEADERS.length).setValues([CRM_HEADERS]);
  target.setFrozenRows(1);
  if (output.length) {
    target.getRange(2, 1, output.length, CRM_HEADERS.length).setValues(output);
  }
}

/**
 * Optional: trigger onEdit để auto sync khi paste vào CRM_RAW.
 */
function onEditSyncCRMRaw(e) {
  const range = e && e.range;
  if (!range) return;
  const sheet = range.getSheet();
  if (sheet.getName() !== CRM_RAW_SHEET) return;
  syncRawSheetToDashboard();
}

function getDashboardDataObjects_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CRM_DASHBOARD_SHEET);
  if (!sh) return [];
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map((h) => String(h).trim());
  return values.slice(1).map((row) => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}

function updateStageByCustomerKey_(customerKey, stage) {
  const key = String(customerKey || "").trim();
  const newStage = String(stage || "").trim();
  if (!key || !newStage) return { ok: false, error: "Thiếu customerKey hoặc stage." };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CRM_DASHBOARD_SHEET);
  if (!sh) return { ok: false, error: `Không tìm thấy sheet ${CRM_DASHBOARD_SHEET}.` };

  const values = sh.getDataRange().getValues();
  if (values.length < 2) return { ok: false, error: "Sheet không có dữ liệu." };

  const headers = values[0].map((h) => String(h || "").trim());
  const idx = (name) => headers.indexOf(name);
  const iCustomerKey = idx("customer_key");
  const iLifecycleStage = idx("lifecycle_stage");
  const iLeadClass = idx("lead_classification");
  const iPotential = idx("potential_rating");
  if (iCustomerKey < 0) return { ok: false, error: "Thiếu cột customer_key." };

  let updated = 0;
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][iCustomerKey] || "").trim() !== key) continue;
    if (iLifecycleStage >= 0) sh.getRange(r + 1, iLifecycleStage + 1).setValue(newStage);
    if (iLeadClass >= 0) sh.getRange(r + 1, iLeadClass + 1).setValue(newStage);
    if (iPotential >= 0) sh.getRange(r + 1, iPotential + 1).setValue(newStage);
    updated += 1;
  }

  if (!updated) return { ok: false, error: `Không tìm thấy customer_key=${key}.` };
  return { ok: true, customerKey: key, stage: newStage, updatedRows: updated, updatedAt: new Date().toISOString() };
}

function updateSalesStatusByCustomerKey_(customerKey, salesStatus) {
  const key = String(customerKey || "").trim();
  const newSalesStatus = String(salesStatus || "").trim();
  if (!key) return { ok: false, error: "Thiếu customerKey." };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CRM_DASHBOARD_SHEET);
  if (!sh) return { ok: false, error: `Không tìm thấy sheet ${CRM_DASHBOARD_SHEET}.` };

  const values = sh.getDataRange().getValues();
  if (values.length < 2) return { ok: false, error: "Sheet không có dữ liệu." };

  const headers = values[0].map((h) => String(h || "").trim());
  const idx = (name) => headers.indexOf(name);
  const iCustomerKey = idx("customer_key");
  const iSalesStatusFinal = idx("sales_status_final");
  if (iCustomerKey < 0) return { ok: false, error: "Thiếu cột customer_key." };
  if (iSalesStatusFinal < 0) return { ok: false, error: "Thiếu cột sales_status_final." };

  let updated = 0;
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][iCustomerKey] || "").trim() !== key) continue;
    sh.getRange(r + 1, iSalesStatusFinal + 1).setValue(newSalesStatus);
    updated += 1;
  }

  if (!updated) return { ok: false, error: `Không tìm thấy customer_key=${key}.` };
  return { ok: true, customerKey: key, salesStatus: newSalesStatus, updatedRows: updated, updatedAt: new Date().toISOString() };
}

function updatePaidValueByCustomerKey_(customerKey, paidValueRaw) {
  const key = String(customerKey || "").trim();
  const raw = String(paidValueRaw || "").trim();
  if (!key) return { ok: false, error: "Thiếu customerKey." };

  const paidValue = raw === "" ? "" : Number(raw);
  if (raw !== "" && !Number.isFinite(paidValue)) {
    return { ok: false, error: "paidValue không hợp lệ." };
  }

  const toNum = (v) => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    if (!s) return null;
    const n = Number(s.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CRM_DASHBOARD_SHEET);
  if (!sh) return { ok: false, error: `Không tìm thấy sheet ${CRM_DASHBOARD_SHEET}.` };

  const values = sh.getDataRange().getValues();
  if (values.length < 2) return { ok: false, error: "Sheet không có dữ liệu." };

  const headers = values[0].map((h) => String(h || "").trim());
  const idx = (name) => headers.indexOf(name);
  const iCustomerKey = idx("customer_key");
  const iRevenue = idx("revenue_usd");
  const iLtv = idx("ltv_usd");
  const iCac = idx("cac_usd");
  const iRoas = idx("roas");
  if (iCustomerKey < 0) return { ok: false, error: "Thiếu cột customer_key." };

  let updated = 0;
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][iCustomerKey] || "").trim() !== key) continue;

    if (iRevenue >= 0) sh.getRange(r + 1, iRevenue + 1).setValue(paidValue);
    if (iLtv >= 0) sh.getRange(r + 1, iLtv + 1).setValue(paidValue);

    if (raw !== "") {
      const rowCac = iCac >= 0 ? toNum(values[r][iCac]) : null;
      const rowRoas = iRoas >= 0 ? toNum(values[r][iRoas]) : null;
      if (iRoas >= 0 && rowCac !== null && rowCac > 0) {
        sh.getRange(r + 1, iRoas + 1).setValue(paidValue / rowCac);
      } else if (iCac >= 0 && (rowCac === null || rowCac <= 0) && rowRoas !== null && rowRoas > 0) {
        sh.getRange(r + 1, iCac + 1).setValue(paidValue / rowRoas);
      }
    }
    updated += 1;
  }

  if (!updated) return { ok: false, error: `Không tìm thấy customer_key=${key}.` };
  return { ok: true, customerKey: key, paidValue: raw, updatedRows: updated, updatedAt: new Date().toISOString() };
}

/**
 * Web endpoint để dashboard đọc data mà không cần Publish CSV.
 * URL dạng: https://script.google.com/macros/s/.../exec
 * Hỗ trợ:
 * - /exec?format=json
 * - /exec?format=json&callback=myFunc (JSONP để tránh CORS)
 */
function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || "").trim();
  if (action === "updatePaidValue") {
    const customerKey = String((e && e.parameter && e.parameter.customerKey) || "").trim();
    const paidValue = String((e && e.parameter && e.parameter.paidValue) || "").trim();
    const result = updatePaidValueByCustomerKey_(customerKey, paidValue);
    const callbackAction = String((e && e.parameter && e.parameter.callback) || "").trim();
    const actionPayload = JSON.stringify(result);
    if (callbackAction) {
      return ContentService
        .createTextOutput(`${callbackAction}(${actionPayload});`)
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService
      .createTextOutput(actionPayload)
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "updateSalesStatus") {
    const customerKey = String((e && e.parameter && e.parameter.customerKey) || "").trim();
    const salesStatus = String((e && e.parameter && e.parameter.salesStatus) || "").trim();
    const result = updateSalesStatusByCustomerKey_(customerKey, salesStatus);
    const callbackAction = String((e && e.parameter && e.parameter.callback) || "").trim();
    const actionPayload = JSON.stringify(result);
    if (callbackAction) {
      return ContentService
        .createTextOutput(`${callbackAction}(${actionPayload});`)
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService
      .createTextOutput(actionPayload)
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "updateStage") {
    const customerKey = String((e && e.parameter && e.parameter.customerKey) || "").trim();
    const stage = String((e && e.parameter && e.parameter.stage) || "").trim();
    const result = updateStageByCustomerKey_(customerKey, stage);
    const callbackAction = String((e && e.parameter && e.parameter.callback) || "").trim();
    const actionPayload = JSON.stringify(result);
    if (callbackAction) {
      return ContentService
        .createTextOutput(`${callbackAction}(${actionPayload});`)
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService
      .createTextOutput(actionPayload)
      .setMimeType(ContentService.MimeType.JSON);
  }

  const format = String((e && e.parameter && e.parameter.format) || "json").toLowerCase();
  const callback = String((e && e.parameter && e.parameter.callback) || "").trim();
  const rows = getDashboardDataObjects_();
  const payload = JSON.stringify({
    source: CRM_DASHBOARD_SHEET,
    rowCount: rows.length,
    updatedAt: new Date().toISOString(),
    rows,
  });

  if (callback) {
    return ContentService
      .createTextOutput(`${callback}(${payload});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  if (format === "json") {
    return ContentService
      .createTextOutput(payload)
      .setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService
    .createTextOutput(payload)
    .setMimeType(ContentService.MimeType.JSON);
}
