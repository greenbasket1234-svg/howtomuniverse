/**
 * 광고관제소 Google Sheets 수신 예제
 * 1) Google Sheet > 확장 프로그램 > Apps Script
 * 2) 이 코드를 붙여넣고 배포 > 새 배포 > 웹 앱
 * 3) 실행 사용자: 나, 액세스 사용자: 배포 환경에 맞게 선택
 * 4) 생성된 /exec URL을 광고관제소 환경설정에 입력
 */
function doPost(e) {
  var payload = JSON.parse(e.postData.contents || '{}');
  if (payload.test) {
    return ContentService.createTextOutput(JSON.stringify({ ok: true, test: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  var report = payload.report;
  var target = payload.googleSheets || {};
  var spreadsheet = target.spreadsheetId
    ? SpreadsheetApp.openById(target.spreadsheetId)
    : SpreadsheetApp.getActiveSpreadsheet();
  var baseName = target.sheetName || '일일보고';
  var sheetName = baseName + '_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
  var sheet = spreadsheet.insertSheet(sheetName.substring(0, 90));

  var summary = [
    ['광고관제소 일일보고'],
    ['광고주', report.advertiser],
    ['리포트명', report.title],
    ['기간', report.period],
    ['생성일', report.createdAt],
    [],
    ['총 광고비', report.summary.spend],
    ['총 노출', report.summary.impressions],
    ['총 클릭', report.summary.clicks],
    ['총 DB', report.summary.db],
    ['총 매출', report.summary.sales],
    ['전체 ROAS', report.summary.roas / 100],
    [],
    target.header,
  ];
  var rows = summary.concat(target.rows || []).concat([[], target.metricHeader]).concat(target.metricRows || []);
  var width = Math.max.apply(null, rows.map(function(row){ return row.length || 1; }));
  rows = rows.map(function(row){
    var copy = row.slice();
    while (copy.length < width) copy.push('');
    return copy;
  });
  sheet.getRange(1, 1, rows.length, width).setValues(rows);
  sheet.getRange(1, 1, 1, width).merge().setFontSize(16).setFontWeight('bold').setBackground('#1f4ed8').setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, width);
  return ContentService.createTextOutput(JSON.stringify({ ok: true, spreadsheetUrl: spreadsheet.getUrl(), sheetName: sheet.getName() }))
    .setMimeType(ContentService.MimeType.JSON);
}
