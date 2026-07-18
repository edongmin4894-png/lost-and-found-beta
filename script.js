function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);
  
  // 1. Base64로 인코딩된 이미지를 디코딩하여 구글 드라이브에 저장
  var imageBlob = Utilities.newBlob(Utilities.base64Decode(data.imageFile), data.mimeType, data.fileName);
  var folder = DriveApp.getFolderById("https://script.google.com/macros/s/AKfycbzSBKhSyjNlJNyekhKNh0vu0Q6TUpqFSuGWkwANb7RafQQ6gpWNnDSTxHExNIHiel4q/exec");
  var file = folder.createFile(imageBlob);
  var fileUrl = file.getUrl();
  
  // 2. 구글 시트에 데이터 추가
  sheet.appendRow([new Date(), data.itemName, data.features, fileUrl]);
  
  return ContentService.createTextOutput("성공적으로 등록되었습니다.");
}