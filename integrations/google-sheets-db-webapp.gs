/**
 * HOWTOM 유니버스 · Google Sheets DB 읽기용 Apps Script
 *
 * 1) DB 집계 시트에 아래 권장 헤더를 사용합니다.
 *    날짜 | 광고주 | 매체 | campaignId | 캠페인명 | creativeId | 소재명 | DB | 유효DB | 계약 | 광고비 | 매출 | 플랫폼전환
 * 2) 확장 프로그램 > Apps Script에 이 코드를 붙여넣습니다.
 * 3) 웹 앱으로 배포합니다. 실행 사용자: 나 / 액세스 권한: 링크가 있는 사용자(조직 정책에 맞게 선택)
 * 4) 배포된 /exec URL을 HOWTOM 유니버스 > 설정 > DB·Google Sheets 연동에 입력합니다.
 *
 * 고객 이름, 전화번호, 이메일 등 개인정보 컬럼은 이 API가 반환하지 않습니다.
 */

const HOWTOM_DB_ALLOWED_HEADERS = [
  '날짜','일자','date',
  '광고주','광고주명','advertiser','advertiserId','광고주ID',
  '매체','채널','플랫폼','media','channel','platform',
  'accountId','계정ID',
  'campaignId','캠페인ID','캠페인명','campaign','campaignName',
  'creativeId','소재ID','소재아이디','creativeName','소재명','광고소재명','광고명','adId','adName',
  'DB','DB수','DB건수','리드','lead','leads',
  '유효DB','유효DB수','validDb','validLead','validLeads',
  '계약','계약수','계약건수','contract','contracts',
  '광고비','비용','spend','cost',
  '매출','매출액','revenue','sales',
  '플랫폼전환','광고플랫폼전환','platformConversions'
];

function doGet(e) {
  try {
    const sheetName = (e && e.parameter && e.parameter.sheet) || '';
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = sheetName ? spreadsheet.getSheetByName(sheetName) : spreadsheet.getSheets()[0];
    if (!sheet) return howtomJson_({ ok:false, message:'시트를 찾을 수 없습니다.', rows:[] });

    const values = sheet.getDataRange().getDisplayValues();
    if (!values || values.length < 2) return howtomJson_({ ok:true, sheet:sheet.getName(), rows:[] });

    const headers = values[0].map(String);
    const allowedIndex = headers
      .map((header, index) => HOWTOM_DB_ALLOWED_HEADERS.indexOf(header.trim()) >= 0 ? index : -1)
      .filter(index => index >= 0);

    const rows = values.slice(1).filter(row => row.some(value => String(value).trim() !== '')).map(row => {
      const out = {};
      allowedIndex.forEach(index => out[headers[index]] = row[index]);
      return out;
    });

    return howtomJson_({ ok:true, sheet:sheet.getName(), rows:rows, updatedAt:new Date().toISOString() });
  } catch (error) {
    return howtomJson_({ ok:false, message:String(error && error.message || error), rows:[] });
  }
}

function howtomJson_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
