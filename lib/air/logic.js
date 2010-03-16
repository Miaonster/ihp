var UPLOAD_URL = 'https://www.myexerciserx.com/usbupdate/server_upload.php?dest=';
var LOGIN_URL = 'https://www.myexerciserx.com/usbupdate/login.asp';
var CONFIG_URL = 'https://www.myexerciserx.com/usbupdate/ihp_config.xml';
var IHPUSER_URL = 'https://www.myexerciserx.com/usbupdate/ihpuser.asp?id=';
var IHPPROCESS_URL = 'https://www.myexerciserx.com/usbupdate/process.asp?id=';

var file = null;
var LOCAL_FILE_ARRAY = [];
var ID_NUMBER = null;
var curr_config_index = 0;
var filecount = 0;
var ROOT_DRIVES = [];

var os = air.Capabilities.os.substr(0, 3).toLowerCase();

//lets get it started... 
function doLoad(){
    $("#wrapper, #footer").delay(2000).fadeIn("slow");
    //check for update
    var appUpdater = new runtime.air.update.ApplicationUpdaterUI();
    appUpdater.configurationFile = new air.File("app:/updateConfig.xml");
    appUpdater.initialize();
    appUpdater.checkNow();
    
    //upload
    directory = air.File.documentsDirectory;
    //directory.addEventListener(air.Event.SELECT, doSelectUpload);
    
    enterHandler();
    
    //login/logout
    $('#remember').click(function(){
        doRemember();
    });
    $('#signin').click(function(){
        doSignIn();
    });
    $('#signout, #exit').click(function(){
        doSignOut();
    });
    
    rememberUser();
    
    var timer = new air.Timer(1000);
    
    $("#upload").colorbox({
        width: "75%",
        inline: true,
        href: "#file_list",
        onOpen: function(){
            //iterate through and find root directories.
            
            
            
            timer.addEventListener(air.TimerEvent.TIMER, get_root_dirs);
            timer.start();
        },
        onClosed: function(){
        
            doSelectUpload();
            timer.stop();
        }
    });
    
    //clicks
    $('#reminder_link').click(function(){
        var url = "https://www.myexerciserx.com/mfc_managepc.asp?task=pin";
        var urlReq = new air.URLRequest(url);
        air.navigateToURL(urlReq);
        
    });
    
    $('.drive_letters').live('click', function(event){
        
		//alert($(this).text());
		var drive_path = "";
        
        if (os == "win") {
            drive_path = $(this).text();
        }
        else {
            drive_path = '/Volumes/' + $(this).text();
        }
        
        directory = new air.File(drive_path);
        
        $.fn.colorbox.close();
    });
    
    
    get_root_dirs();
}

function get_root_dirs(){

    var currentDrives = new air.File;
    
    if (os == "win") {
        currentDrives = air.File.getRootDirectories();
    }
    else {
        currentDrives = new air.File('/Volumes/').getDirectoryListing();
    }
    
    
    if (currentDrives.length != ROOT_DRIVES.length) {
        $("#file_list").html("");
        for (i = 0; i < currentDrives.length; i++) {
            //build drive links
            if ((currentDrives[i].name).length < 20) {
                $("#file_list").append("<p><a class='drive_letters' href='#'>" + currentDrives[i].name + "</a></p>");
            }
            
        }
        $.fn.colorbox.resize();
    }
    
    ROOT_DRIVES = currentDrives;
}
function enterHandler(event){
    $('body').keypress(function(e){
        if (e.which == 13) {
        
            if ($('#signin').is(':visible')) {
                doSignIn();
            }
            
            e.preventDefault();
            return false;
        }
        
    });
    
}

function rememberUser(){
    var username = air.EncryptedLocalStore.getItem('username');
    var pass = air.EncryptedLocalStore.getItem('password');
    
    if (username != null) {
        document.getElementById('username').value = username.readUTFBytes(username.bytesAvailable);
        document.getElementById('password').value = pass.readUTFBytes(pass.bytesAvailable);
        document.getElementById('remember').checked = true;
    }
    else {
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        document.getElementById('remember').checked = false;
    }
}

function doRemember(){
    var username = air.EncryptedLocalStore.getItem('username');
    var pass = air.EncryptedLocalStore.getItem('password');
    
    if (username != null) {
        removeUser();
    }
}

function removeUser(){
    air.EncryptedLocalStore.removeItem('username');
    air.EncryptedLocalStore.removeItem('password');
}


function doSignIn(){
    var data = null;
    var username = null;
    var password = null;
    var success_login = false;
    var return_data = null;
    
    loadingIndicator(true);
    
    username = document.getElementById('username').value;
    password = document.getElementById('password').value;
    
    //CHECK username AND PASSWORD COMBO FROM SERVER
    request = new air.URLRequest(LOGIN_URL);
    
    request.data = "lname=" + username + "&password=" + password;
    
    loader = new air.URLLoader();
    loader.addEventListener(air.Event.COMPLETE, function(event){
    
        //alert(event.target.data);
        
        return_data = event.target.data.split("|");
        ID_NUMBER = return_data[1];
        //air.trace("#" + ID_NUMBER);
        
        
        //air.trace(event.target.data);
        //air.trace(return_data[0]);
        
        if (return_data[0] == "success") {
        
            $('#login_items').fadeOut('fast');
            $('#main').delay(1000).fadeIn('slow');
            $('#invalid_login').stop().fadeOut('fast');
            
            if (document.getElementById('remember').checked) {
            
                data = new air.ByteArray();
                data.writeUTFBytes(username);
                air.EncryptedLocalStore.setItem('username', data);
                
                data = new air.ByteArray();
                data.writeUTFBytes(password);
                air.EncryptedLocalStore.setItem('password', data);
                
            }
            else {
                removeUser();
                
            }//if remember checked 
            //get config;
            getConfig(CONFIG_URL);
            
            
        }//if(event.target.data == "success"){
        else 
            if (event.target.data == "fail") {
            
                removeUser();
                
                $('#invalid_login').stop().fadeIn('fast');
                
                //reset username and password    
                username = document.getElementById('username').value = '';
                password = document.getElementById('password').value = '';
            }//else if(event.target.data == "fail")    
    });// loader callback function  
    try {
        loader.load(request);
    } 
    catch (error) {
        alert("Could not contact server.");
    }
    loadingIndicator(false);
    
}//function doSignIn
function doSignOut(){

    $('#main, #login_items').fadeOut('slow', function(){
        loadingIndicator(true);
        rememberUser();
        
        $('#message').text('IHP Data Communicator session ending...').fadeIn('fast').delay(3000).fadeOut('slow', function(){
            Quit();
        });
        
    });
}


function doSelectUpload(e){
    blinkmessage('Processing...');
    loadingIndicator(true);
    var request = new air.URLRequest(UPLOAD_URL + ID_NUMBER);
    
    
    request.contentType = 'multipart/form-data';
    request.method = air.URLRequestMethod.POST;
    
    
    //parse baby parse
    //find all the files retrieved from config
    var files = directory.getDirectoryListing();
    var localname = null;
    var configname = null;
    var uploadcount = 0;
    curr_config_index = 0;
    
    
    for (var lf = 0; lf < LOCAL_FILE_ARRAY.length; lf++) {
        configname = LOCAL_FILE_ARRAY[lf];
        
        for (var f = 0; f < files.length; f++) {
            localname = files[f].name;
            //##air.trace("comparing: "+localname+" to: "+configname );
            if ((localname.toLowerCase() == configname.toLowerCase()) && (!files[f].isDirectory)) {
                //upload the file
                //alert(localname);
                files[f].upload(request, "AIRfile");
                
                files[f].addEventListener(air.IOErrorEvent.IO_ERROR, fileErrorHandler);
                
                files[f].addEventListener(air.Event.COMPLETE, fileCompleteHandler);
                count_this_file(files[f]);
                uploadcount++;
            }
        }//END for( var f = 0; f < files.length; f++ )
        curr_config_index++;
        
    }//END for( var lf = 0; lf < LOCAL_FILE_ARRAY.length; lf++ ){
    if (uploadcount == 0) {
        loadingIndicator(false);
        blinkmessage('No workout data found');
        //GET IHPUSERFILE
        getIHPUSERFILE();
        
    }
    else {
        //GET IHPUSERFILE
        getIHPUSERFILE();
        
        blinkmessage('Uploading workout data...');
        
        $('#upload').attr('disabled', null);
        //blinkmessage('Personal data synched');
    }
    
}//doSelectUpload
function fileErrorHandler(event){
    //air.trace("A file IO error has occurred: "+event);
    alert("#" + ID_NUMBER + ", There was an error uploading the file : " + event);
    
}

function fileCompleteHandler(event){
    //air.trace("The file upload has completed." + event);
    
    //air.trace("curr_config_index: " + curr_config_index);
    //air.trace("LOCAL_FILE_ARRAY.length: "+LOCAL_FILE_ARRAY.length);
    
    if (LOCAL_FILE_ARRAY.length == curr_config_index) {
        //alert("processed all files... call process");
        callProcess();
        
    }
    
}

function count_this_file(thefile){
    //air.trace(thefile);
    //air.trace("delete: " + thefile.name);
    //thefile.deleteFile();
    filecount++;
}

function Quit(){
    var event = new air.Event(air.Event.EXITING, false, true);
    air.NativeApplication.nativeApplication.dispatchEvent(event);
    if (!event.isDefaultPrevented()) {
        air.NativeApplication.nativeApplication.exit();
    }
}



function getConfig(config_url){

    xml = new XMLHttpRequest();
    
    xml.onreadystatechange = function(){
        var elem = null;
        var filename = null;
        var getthesefiles = null;
        
        if (xml.readyState == 4) {
            getthesefiles = xml.responseXML.documentElement.getElementsByTagName('localfile');
            
            for (var c = 0; c < getthesefiles.length; c++) {
                filename = getthesefiles[c].getElementsByTagName('filename')[0].textContent;
                LOCAL_FILE_ARRAY[c] = filename;
            }
            
        }
    }
    
    xml.open('GET', config_url, true);
    xml.send(null);
    
    
}//function getConfig(config_url){
function getIHPUSERFILE(){

    var request = new air.URLRequest(IHPUSER_URL + ID_NUMBER);
    
    request.contentType = 'multipart/form-data';
    request.method = air.URLRequestMethod.POST;
    
    
    var loader = new air.URLLoader();
    loader.addEventListener(air.ProgressEvent.PROGRESS, function(e){
    
    });
    loader.addEventListener(air.IOErrorEvent.IO_ERROR, function(e){
        //air.trace( 'error: '+ e.text );
        
        blinkmessage('No personal data found on the website. Please check your account information screen to make sure those details are present.');
    });
    loader.addEventListener(air.Event.COMPLETE, function(e){
        //air.trace( loader.data );
        
        
        var file = directory.resolvePath('IHPUSER.TXT');
        var stream = new air.FileStream();
        
        stream.open(file, air.FileMode.WRITE);
        stream.writeMultiByte(loader.data, air.File.systemCharset);
        stream.close();
        
        //blinkmessage('Personal data file downloaded.');
    
    });
    loader.load(request);
    
}//function getIHPUSERFILE
function callProcess(){
    //air.trace("in process function!!! :" + filecount);
    filecount--;
    
    if (filecount == 0) {
        //alert("call process.asp!!!");
        var urlString = IHPPROCESS_URL + ID_NUMBER;
        var urlReq = new air.URLRequest(urlString);
        var urlStream = new air.URLStream();
        
        urlStream.addEventListener(air.Event.COMPLETE, function(e){
        
            //air.trace("done... delete files now!");
            var files = directory.getDirectoryListing();
            //delete the files after all the uploads are complete
            for (var lf = 0; lf < LOCAL_FILE_ARRAY.length; lf++) {
                configname = LOCAL_FILE_ARRAY[lf];
                for (var f = 0; f < files.length; f++) {
                    localname = files[f].name;
                    if ((localname.toLowerCase() == configname.toLowerCase()) && (!files[f].isDirectory)) {
                        //delete the file
                        files[f].deleteFile();
                    }
                }//END for( var f = 0; f < files.length; f++ )
            }//END for( var lf = 0; lf < LOCAL_FILE_ARRAY.length; lf++ ){
            loadingIndicator(false);
            blinkmessage('Personal data synched.', true);
            //alert("done");
        
        });//END urlStream.addEventListener(air.Event.COMPLETE, function(e){
        urlStream.load(urlReq);
    }
    else {
    
        //air.trace("decrese filecount " + filecount);
    
    }
    
}

//utility functions
function blinkmessage(msg, sticky){

    if (sticky) {
        $('#message').stop(false, true).fadeOut('fast').delay(100).text(msg).delay(100).fadeIn('fast');
    }
    else {
        $('#message').stop(false, true).fadeOut('fast').delay(100).text(msg).delay(100).fadeIn('fast').delay(3000).fadeOut('slow');
    }
}

function loadingIndicator(show){
    if (show) {
        $('#progress').fadeIn('fast');
    }
    else {
        $('#progress').fadeOut('fast');
    }
}
