function checkForNewContent() {
 var label = GmailApp.getUserLabelByName("Text Messages");
 var emails = label.getThreads();
 var emailCount = emails.length;
  
  Logger.log(emailCount);
  for(var i = 0; i < emailCount;i++)
  {
    processMessagesFromThread(emails[i].getId());
    emails[i].removeLabel(label);
    emails[i].moveToTrash();
    Gmail.Users.Threads.remove("me", emails[i].getId());
  }
   
 }
 
function processMessagesFromThread(emailID)
{
  var email = GmailApp.getThreadById(emailID);
  var userAddress = email.getMessages()[0].getFrom();
  var newUser = isUserNew(userAddress);
  // Iterate through all the emails that are sent(limit up to 500)
  var responses = [];
  
  if(newUser)
  {
    var url = createSitePage(userAddress);
    addUserToSheet(userAddress);
    createFolderContent(userAddress);
    responses.push(Welcome(userAddress,url));
  }
  
  
  var phoneNumber = userAddress.split(".")[1].split(".")[0];
  //if your not a new user get page
  
  //iterate through the messages
  
  var idString = getContentFromMessages(emailID);
  
  writeIdsToDatabase(userAddress,idString);
  
  var pageUrl = addFilesToPage(idString,userAddress);
  
  
  
  var success = "You have successfully posted " + idString.split(",").length + " files to your page!";
  responses.push(success);
  
  var visit = "You can visit your page at " + pageUrl;
  responses.push(visit);
  
  var body = responses.join(" ");
  
  
  MailApp.sendEmail(userAddress, "Response", body);
  
      
}

function writeIdsToDatabase(userAddress,idString)
{
  var ids = idString.split(",");
  var databaseID = getUserDatabase(userAddress);
  var userDatabase = SpreadsheetApp.openById(databaseID);
  var sheet = userDatabase.getSheetByName("sheet1");
  var lastRow = sheet.getLastRow();
  var addedFileRange =  sheet.getRange(lastRow + 1, 1, ids.length);
  var addedFileTypeRange = sheet.getRange(lastRow + 1, 2,ids.length);
  
  for(var q = 1;q < ids.length + 1;q++)
  {
    addedFileRange.getCell(q, 1).setValue(ids[q - 1]);
  }
  
  for(var z = 1; z < ids.length + 1;z++)
  {
    addedFileTypeRange.getCell(z, 1).setValue(DriveApp.getFileById(ids[z-1]).getMimeType());
  }
  
}

function addFilesToPage(idString,userAddress)
{
  var phoneNumber = userAddress.split(".")[1].split(".")[0];
  var blogSite = SitesApp.getSites()[0];
  var page = blogSite.getChildByName(phoneNumber);
  var ids = idString.split(",");
  var sheetApp = SpreadsheetApp.openById(getUserDatabase(userAddress));
  var sheet = sheetApp.getSheetByName("Sheet1");
  var fileNumber = sheetApp.getLastRow();
  
  
  for(var i = fileNumber; i < ids.length + fileNumber;i++)
  {
    
    //var file = Drive.Files.get(ids[i]);
    var fileType = sheet.getRange(i - 1, 2).getCell(1, 1).getDisplayValue();
    if(fileType == 'application/pdf' || fileType == 'application/vnd.google-apps.document' || fileType == "application/vnd.google-apps.document")
    {
      var current = new Date();
      var document = DocumentApp.openById(ids[i - fileNumber]);
      var name = document.getName();
      var message = document.getBody().getText();
      page.createAnnouncement( phoneNumber + " just uploaded file number " + fileNumber , "<p>" + message + "</p>");
    }
    else
    {
    var file = Drive.Files.get(ids[i - fileNumber]);
    var fileName = DriveApp.getFileById(ids[i - fileNumber]).getName();
    page.createAnnouncement(fileName,"<iframe src=\"" + file.embedLink + "\"></iframe>");
    }
  }
  
  var url = page.getUrl();
  
  return url;
}

function getContentFromMessages(emailID)
{
  //loops through the emails messages
  var current = new Date();
  var email = GmailApp.getThreadById(emailID);
  
  var messages = email.getMessages();
  
  var storedContent = [];
  
  for(var m = 0; m < messages.length;m++)
  {
  var number = messages[m].getReplyTo();
  var senderAddress = messages[m].getFrom();
  
  var body = messages[m].getBody();
        
  var message = getMessageFromHtml(body);//stores messages in the message field
  
  var isLocation = Contains(message,"http://maps.google.com/maps?q=");
    
  if(message != "" && message.toLowerCase() != "MMS Received".toLowerCase() && isLocation == false)
  {
    var phoneNumber = senderAddress.split(".")[1].split(".")[0];
    var userFolder = DriveApp.getFolderById(DriveApp.getFoldersByName(phoneNumber + "'s Folder").next().getId());
    var documentFolder = DriveApp.getFolderById(userFolder.getFoldersByName("Text").next().getId());
    var newDocFile =  Drive.Files.insert({"mimeType": "application/vnd.google-apps.document","parents": [{id: documentFolder.getId()}],"title": current +  " Document"});
     var docFile = DocumentApp.openById(newDocFile.getId());
    var docBody = docFile.getBody();
     docBody.editAsText().setFontSize(25);
     docBody.appendParagraph(message);
    storedContent.push(newDocFile.getId());
  }
  else if(isLocation)
  {
    var phoneNumber = senderAddress.split(".")[1].split(".")[0];
    var userFolder = DriveApp.getFolderById(DriveApp.getFoldersByName(phoneNumber + "'s Folder").next().getId());
    var imageFolder = DriveApp.getFolderById(userFolder.getFoldersByName("Images").next().getId());
    var location = message.split("=")[1].split(",");
    var latitude = location[0];
    var longitude = location[1];
    var gpsParser = Maps.newGeocoder().reverseGeocode(latitude, longitude);
    var address = gpsParser.results[0].formatted_address;
    var mapImage = Maps.newStaticMap().addMarker(latitude, longitude).getBlob();
    
    var image = imageFolder.createFile(mapImage);
    image.setName(address);
    image.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);
    storedContent.push(image.getId());
  }
  else 
  storedContent.push(createFilesFromAttachment(messages[m].getId()));
  }
  var ids = storedContent.join();
  Logger.log(ids);
  return ids;
        
}

function isUserNew(phoneAddress)
{
  var dataSheet = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("dataSheetID"));
  var storageSheet = dataSheet.getSheetByName("sheet1");
  var lRow = storageSheet.getLastRow();
  var lColumn = storageSheet.getLastColumn();
  var userAddresses = storageSheet.getRange(2, 1, lRow);
  var addressValues = userAddresses.getDisplayValues();
  
  for(var r = 0; r < addressValues.length;r++)
  {
    var currentAddress = addressValues[0][r];
    if(phoneAddress == currentAddress)
     return false;
  }

  return true;
  
}

function createSitePage(userAddress)
{
  var site = SitesApp.getSiteByUrl("https://sites.google.com/site/phonebloggerplus");
  var phoneNumber = userAddress.split(".")[1].split(".")[0];
  var newPage = site.createAnnouncementsPage(phoneNumber +  "'s Page", phoneNumber, "Hey! I just created a new " + site.getName() + " page!");
  return newPage.getUrl();
}

function Welcome(url)
{
  
  var welcomeString = "Thank you for joining PhoneBloggerPlus! You can visit" +
  " your page by visiting" + url + ". You can look up your friends pages by typing their "+
  "number in the search bar. To subscribe to updates of your friends blog, type Subscribe#Number." +
   " we know you can impact someones life today, so thank you for joining this community.";
  
  return welcomeString;
}

function createFolderContent(userAddress)
{
  //userAddress = "\"(347) 393-2274\" <17854087189.13473932274.N2BVDjjwCk@txt.voice.google.com>"
   var phoneNumber = userAddress.split(".")[1].split(".")[0];
  var siteFolder = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty("pbFolderID"));
  var userFolder = siteFolder.createFolder(phoneNumber + "'s Folder");
  var moviesFolder = userFolder.createFolder("Movies");// music and movies
  var musicFolder = userFolder.createFolder("Music");// music and movies
  var textFolder = userFolder.createFolder("Text");
  var imageFolder = userFolder.createFolder("Images");
  var spreadFile =  Drive.Files.insert({"mimeType": "application/vnd.google-apps.spreadsheet","parents": [{id: userFolder.getId()}],"title": "User Database"});
  var sheet = SpreadsheetApp.openById(spreadFile.id);
  var newSheet = sheet.getSheetByName("sheet1");
 newSheet.getRange(1, 1).getCell(1, 1).setValue("File Ids");
  newSheet.getRange(1, 2).getCell(1, 1).setValue("File Types");
  
  logDatabaseID(userAddress,spreadFile.id);
  
  return userFolder.getId();
  
}
  

function logDatabaseID(userAddress,trackerId)
{
  var dataSheet = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("dataSheetID"));
  var storageSheet = dataSheet.getSheetByName("sheet1");
  var lRow = storageSheet.getLastRow();
  var lColumn = storageSheet.getLastColumn();
  var userAddresses = storageSheet.getRange(2, 1, lRow);
  var addressValues = userAddresses.getDisplayValues();
  
  for(var r = 0; r < addressValues.length;r++)
  {
    var currentAddress = addressValues[r][0];//coming up null for some reason
    if(userAddress == currentAddress)
    {
      var typeCell = storageSheet.getRange(r + 2, 2).getCell(1, 1);
      typeCell.setValue(trackerId);
      break;
    }
  }
  
}


function getUserDatabase(userAddress)
{
  var dataSheet = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("dataSheetID"));
  var storageSheet = dataSheet.getSheetByName("sheet1");
  var lRow = storageSheet.getLastRow();
  var lColumn = storageSheet.getLastColumn();
  var userAddresses = storageSheet.getRange(2, 1, lRow);
  var addressValues = userAddresses.getDisplayValues();
  
  for(var r = 0; r < addressValues.length;r++)
  {
    var currentAddress = addressValues[0][r];
    if(userAddress == currentAddress)
    {
      var typeCell = storageSheet.getRange(r + 2, 2).getCell(1, 1);
      var returning = typeCell.getDisplayValue();
      return returning;
    }
  }
  
  var phoneNumber = userAddress.split(".")[1].split(".")[0];
  var userFolder = DriveApp.getFolderById(DriveApp.getFoldersByName(phoneNumber + "'s Folder").next().getId());
  var dataBase = userFolder.getFilesByType("application/vnd.google-apps.spreadsheet").next().getId();
  
  
  return dataBase;
  
}

function addUserToSheet(userAddress)
{
  var dataSheet = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("dataSheetID"));
  var storageSheet = dataSheet.getSheetByName("Sheet1");
  var lRow = storageSheet.getLastRow();
  var lColumn = storageSheet.getLastColumn();
  var userRow = storageSheet.getRange(lRow + 1, 1).getCell(1, 1);
  userRow.setValue(userAddress);
}

function createFilesFromAttachment(messageId)
{

  var message = GmailApp.getMessageById(messageId);
  var userAddress = message.getFrom();
  var phoneNumber = userAddress.split(".")[1].split(".")[0];
  var userFolder = DriveApp.getFolderById(DriveApp.getFoldersByName(phoneNumber + "'s Folder").next().getId());
  var imageFolder = DriveApp.getFolderById(userFolder.getFoldersByName("Images").next().getId());
  var documentFolder = DriveApp.getFolderById(userFolder.getFoldersByName("Text").next().getId());
  var moviesFolder = DriveApp.getFolderById(userFolder.getFoldersByName("Movies").next().getId());
  var musicFolder = DriveApp.getFolderById(userFolder.getFoldersByName("Music").next().getId());
  var fileId = "";
  var attachment = message.getAttachments()[0];
  var stored = attachment.getContentType();
  var current = new Date();
  
  switch(stored)
  {
          case 'audio/amr':
            var voiceMessage = attachment.getAs('audio/amr');
            voiceMessage.setName(current + " audio");
            var file = musicFolder.createFile(voiceMessage);
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            fileId = file.getId();
            break;
          case 'image/gif':
            var Image = attachment.getAs('image/gif');
            Image.setName(current + " Image");
            var file = imageFolder.createFile(Image);
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            fileId = file.getId();
            break;
          case 'image/bmp':
            var Image = attachment.getAs('image/bmp');
            Image.setName(current + " Image");
            var file = imageFolder.createFile(Image);
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            fileId = file.getId();
            break;
          case 'application/pdf':
            var Document = attachment.getAs('application/vnd.google-apps.document');
            Document.getBody().editAsText().setFontSize("20");
            Document.setName(current + " Document");
            var file = documentFolder.createFile(Document);
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            fileId = file.getId();
            break;
          case 'image/jpg':
            var Image = attachment.getAs('image/jpg');
            Image.setName(current + " Image");
            var file = imageFolder.createFile(Image);
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            fileId = file.getId();
            break;
          case 'image/png':
            var Image = attachment.getAs('image/png');
            Image.setName(current + " Image");
            var file = imageFolder.createFile(Image);
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            fileId = file.getId();
            break;
          case 'video/mp4':
            var video = attachment.getAs('video/mp4');
            video.setName(current + " video recording");
            var file = moviesFolder.createFile(video);
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
             fileId = file.getId();
            break;
         case 'audio/mp4':
             var audio = attachment.getAs('audio/mp4');
            audio.setName(current + " voice recording");
            var file = musicFolder.createFile(audio);
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
             fileId = file.getId();
         break;
          default:
            var Image = attachment.getAs('image/png');
            Image.setName(current + " Image");
            var file = imageFolder.createFile(Image);
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            fileId = file.getId();
            break;
    }
  return fileId;
}

function getMessageFromHtml(htmlString)
{
  var stored = htmlString;
  var search = "<td style=\"font-size: 14px; line-height: 20px; padding: 25px 0;\">";
  var index = htmlString.search(search);
  if(index >= 0)
  {
    var pos = index + search.length;
    var substring = htmlString.substring(pos, htmlString.length);
    var endTag = "</td>".split('');
    var array = substring.split('');
    var endIndex = 0;
    for(var i=0; i < substring.length;i++)
    {
      if(endIndex !=0)
        break;
      if(array[i] == endTag[0])
      {
        for(var j = 0; j < endTag.length;j++)
        {
          if(array[i + j] !== endTag[j])
            break;
          if(j == endTag.length - 1)
          {
            endIndex = i;
            break;
          }
        }
      }
    }
    
    var raw = substring.substring(0,endIndex);
    
    var message = fixCharacterFlaws(raw);
    Logger.log(message);
    
    return message;
  }
  
}

function Contains(mainString,subString)
{
  var mainArray = mainString.split('');
  var subArray = subString.split('');
  for(var g = 0; g < mainString.length;g++)
  {
    if(mainArray[g] == subArray[0])
    {
      if(g + subArray.length  > mainArray.length)
      {
        return false;
      }
      else
      {
        for(var u = 0; u < subArray.length;u++)
        {
          if(mainArray[g+u] != subArray[u])
            break;
          
          if(u == subArray.length - 1)
            return true;
        }
      }
    }
  }
  
  return false;
}

function fixCharacterFlaws(string)
{
  var stored = "";
  var singleQuoteString = "&#39;";
  var doubleQuoteString = "&quot;";
  stored = string.replace(new RegExp(singleQuoteString, 'g'), "'");
  stored = stored.replace(new RegExp(doubleQuoteString, 'g'), "\"");
  return stored;
}

