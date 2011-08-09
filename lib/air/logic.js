// FOR TESTING
var OFFLINE = false;
var UPLOAD_URL = 'https://www.myexerciserx.com/idc/server_upload.php?dest=';
var LOGIN_URL = 'https://www.myexerciserx.com/idc/login.asp';
var CONFIG_URL = 'https://www.myexerciserx.com/idc/ihp_config.xml';
var IHPUSER_URL = 'https://www.myexerciserx.com/idc/ihpuser.asp?id=';
var IHPPROCESS_URL = 'https://www.myexerciserx.com/idc/process.asp?id=';
var FORGOT_PWD_URL = 'https://www.myexerciserx.com/mfc_managepc.asp?task=pin';

var WE_ARE_DONE = false;
var file = null;
var CONFIG_FILES_ARRAY = [];
var ID_NUMBER = null;
var files_checked_count = 0;
var files_actually_uploaded_count = 0;
var filecount = 0;
var ROOT_DRIVES = [];
var uploadcount = 0;

var RECURSION_DEPTH = 0;
var called_process = false;
var got_IHPUSERFILE = false;

var still_looking = false;

var os = air.Capabilities.os.substr(0, 3).toLowerCase();
var StorageVolumeInfo = window.runtime.flash.filesystem.StorageVolumeInfo.storageVolumeInfo;
	StorageVolumeInfo.addEventListener(window.runtime.flash.events.StorageVolumeChangeEvent.STORAGE_VOLUME_MOUNT, onVolumeMount);
	StorageVolumeInfo.addEventListener(window.runtime.flash.events.StorageVolumeChangeEvent.STORAGE_VOLUME_UNMOUNT, onVolumeUnmount);

var directory;
//lets get it started... 
function doLoad(){
	$("#wrapper, #footer").delay(2000).fadeIn("slow");
	
	
	
	
	//check for update
	var appUpdater = new runtime.air.update.ApplicationUpdaterUI();
	appUpdater.configurationFile = new air.File("app:/updateConfig.xml");
	appUpdater.initialize();
	//alert(appUpdater.currentState);
	appUpdater.checkNow();
	//alert("previous version : " +appUpdater.previousVersion);
	//alert("current version : " + appUpdater.currentVersion);
	
	
   
	//login/logout
	$('#remember').click(function(){
		doRemember();
	});
	$('#signin').click(function(){
		
		if(OFFLINE){
			ID_NUMBER = "298";
			$('#login_items').fadeOut('fast');
			$('#main').delay(1000).fadeIn('slow');
			$('#invalid_login').fadeOut('fast');
			//get config; - possible fail - this will populate: CONFIG_FILES_ARRAY
			getConfig("file:///Library/WebServer/Documents/bbd/sample_files/ihp_config_new.xml");
			//attempt to auto upload
			setTimeout(auto_upload,1000);
		}else{
			doSignIn();
		}
		
	});
	$('#signout, #exit').click(function(){
		doSignOut();
	});
	
	
	var timer = new air.Timer(1000);
	//init light box click handler
	$("#upload").colorbox({
		width: "75%",
		inline: true,
		href: "#file_list",
		onOpen: function(){
			get_root_dirs();
			//iterate through and find root directories. every second
			//timer.addEventListener(air.TimerEvent.TIMER, get_root_dirs);
			//timer.start();
		},
		onClosed: function(){
			//perform upload, the drive should be set now based on the click
			if (ROOT_DRIVES.length > 1) {
				doSelectUpload(directory);
			}
			
			//timer.stop();
		}
	});
	
   //forgot my password link click
	$('#reminder_link').click(function(){
		var url = FORGOT_PWD_URL;
		var urlReq = new air.URLRequest(url);
		air.navigateToURL(urlReq);
		
	});
	
	//select USB is clicked, drive letters are visible, bind click event
	$('.drive_letters').live('click', function(event){
		var drive_path = $(this).attr("rel");
		
		//set directory to the clicked drive letter
		directory = new air.File(drive_path);
		//GET IHPUSERFILE even if there are no uploads, and we just selected a drive.
		getIHPUSERFILE();
		
		//close lightbox when a link is clicked
		$.fn.colorbox.close();
		//disable click events
		$("#upload, .drive_letters").bind("click", function(e){
			e.preventDefault();
			return false;
		}).css("color", "#ccc");
		
		loadingIndicator(true);
		$("#instructions").text("USB Drive Selected").animate({opacity:1}, 2000);
		//$('#task').fadeOut('fast').delay(100).text('Personal data synched.').delay(100).fadeIn('fast');//.delay(5000).fadeOut('slow');
		//blinkmessage('Personal data file downloaded.');
		
	});
	
	//UTILITY FUNCTIONS
	
	//init directory
	//enter should submit, init handler
	enterHandler();
	//remember user init
	rememberUser();
	//get all the directories when application starts 
	//get_root_dirs();
	
	
}

function get_root_dirs(){

	
	//get mounted drives - only check usb drives
	var currentDrives = window.runtime.flash.filesystem.StorageVolumeInfo.storageVolumeInfo.getStorageVolumes();
	
	if ((currentDrives.length != ROOT_DRIVES.length) && (currentDrives.length > 0)) {
		// ROOT_DRIVES will hold the drives we find, but it is possible that they add the usb drive later, so we check to see if both arrays are equal in length.
		$("#file_list").html("Removeable USB drives: ");//clear out the list of drives we found before
		for (i = 0; i < currentDrives.length; i++) {
			//build drive links
			if ((currentDrives[i].rootDirectory.name).length < 20 && (currentDrives[i].isRemovable)) {
				air.trace("found: "+currentDrives[i].rootDirectory.name );
			//if (currentDrives[i].isRemovable) {
				$("#file_list").append("<p><a class='drive_letters' rel='"+currentDrives[i].rootDirectory.nativePath+"' href='#'>" + currentDrives[i].rootDirectory.name + "</a></p>");
			}
			
		}
		//resize light box if we added more drive links
		//$.fn.colorbox.resize();
	}
	
	//assign all the drives we found to a local var for later checks
	ROOT_DRIVES = currentDrives;
}
function enterHandler(event){
	$('body').keypress(function(e){
		if (e.which == 13) {
		
			if ($('#signin').is(':visible')) {
				if(OFFLINE){
					ID_NUMBER = "138";
					$('#login_items').fadeOut('fast');
					$('#main').delay(1000).fadeIn('slow');
					$('#invalid_login').fadeOut('fast');
					//get config; - possible fail - this will populate: CONFIG_FILES_ARRAY
					getConfig("file:///Library/WebServer/Documents/bbd/sample_files/ihp_config_new.xml");
					//attempt to auto upload
					setTimeout(auto_upload,1000);
				}else{
					doSignIn();
				}
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
	request.method = air.URLRequestMethod.POST;
	
	request.data = "lname=" + escape(username) + "&password=" + escape(password);//we should encypt this...
	//air.trace("lname=" + escape(username) + "&password=" + escape(password));
	loader = new air.URLLoader();
	loader.addEventListener(air.Event.COMPLETE, function(event){
		//this is a callback function. when the server comes back with a response, this fires.
		//alert(event.target.data);
		
		return_data = event.target.data.split("|");
		ID_NUMBER = return_data[1];
		//air.trace("#" + ID_NUMBER);
		
		//air.trace(event.target.data);
		//air.trace(return_data[0]);
		
		if (return_data[0] == "success") {
		
			$('#login_items').fadeOut('fast');
			$('#main').delay(1000).fadeIn('slow');
			$('#invalid_login').fadeOut('fast');
			
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
			//get config; - possible fail - this will populate: CONFIG_FILES_ARRAY
			getConfig(CONFIG_URL);
			//attempt to auto upload
			setTimeout(auto_upload,1000);
			
		}//if(event.target.data == "success"){
		else 
			if (event.target.data == "fail") {
			
				removeUser();
				
				$('#invalid_login').fadeIn('fast');
				
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
		$('#task').fadeOut('fast').delay(100).text('Could not contact server.').delay(100).fadeIn('fast');
		loadingIndicator(false);
	}
	loadingIndicator(false);
	
}//function doSignIn
function doSignOut(){
rememberUser();
	$('#main, #login_items').fadeOut('slow', function(){
		loadingIndicator(true);
		
		var urlString = IHPPROCESS_URL + ID_NUMBER;
		var urlReqx = new air.URLRequest(urlString);
	
		var urlStreamx = new air.URLLoader();
		try{
			urlStreamx.load(urlReqx);
		}
		catch (error){
			/*blinkmessage('Unable to contact server, retrying in 30 seconds...', true);
			air.trace("Unable to load URL");
			urlStream.load(urlReq);
			_timeoutTimer = new air.Timer(60000);//60 seconds
			_timeoutTimer.start();*/	
		}
		$('#message').text('IHP Data Communicator session ending...').fadeIn('fast').delay(3000).fadeOut('slow', function(){
				Quit();
		});
		
	});
}
//called upon successful login
function auto_upload(){
	//$('#upload').fadeOut('slow');
	still_looking = true;
	
	blinkmessage('Auto Uploading, please wait...', true);
	loadingIndicator(true);

	
	
	//get mounted drives - only check usb drives in auto upload.
	var volumes = window.runtime.flash.filesystem.StorageVolumeInfo.storageVolumeInfo.getStorageVolumes();
	//alert("volumes length: "+ volumes.length);
	for (var i = 0; i < volumes.length; i++)
	{
	   //alert(volumes[i].rootDirectory.nativePath);
	   //if (still_looking && volumes[i].name !== "null") {
	   if (volumes[i].isRemovable && still_looking && volumes[i].name !== "null" && (volumes[i].rootDirectory.name).length < 20) {
			 
			 //alert("this drive is removeable: "+volumes[i].name+" - attempt upload: "+volumes[i].rootDirectory.nativePath);
			//alert("call upload on: "+volumes[i].name);
			
			directory = new air.File(volumes[i].rootDirectory.nativePath);
			
			doSelectUpload(directory);
		}
		else{
			if(still_looking === true){//we never uploaded anything
				loadingIndicator(false);
				blinkmessage('No workout data found', true);
				$("#instructions")
					.text("Make sure your USB drive is inserted in your computer. Press Select USB Drive. Click on the drive name that corresponds to your USB drive.")
					.animate({opacity:1}, 2000);

				air.trace("doSelectUpload done, no uploads directory:");
			}
		}
	}
		
}
function onVolumeMount(e) {
	
	if (e.storageVolume.isRemovable) { 
		var myNativePath = e.storageVolume.rootDirectory.nativePath; 
		air.trace("callback onVolumeMount: " +  myNativePath);
		get_root_dirs();
		
		if($('#login_items').is(":hidden") && (WE_ARE_DONE === false)){
			$("#upload").click();
		}
		
	} 
} 

function onVolumeUnmount(e) { 
	//do nothing
	get_root_dirs();
}
var fileList = new Array();//I know I know bad global variable
function getFilesRecursive(_directoryPath){
	
	var currentFolder = new air.File(_directoryPath);
	//air.trace(currentFolder.url);
	if((currentFolder.url.split(/\//g).length - 1) > 6){
		//only ever go 3 folders deep the url is something like file:///Volumes/NO%20NAME or file:///F:/True/workouts/test.txt
		//air.trace(currentFolder.url);
		//alert("recursion depth hit");
		return;
	}
	

	//the current folder's file listing
	var _files = currentFolder.getDirectoryListing();

	//iterate and put files in the result and process the sub folders recursively
	for (var f = 0; f < _files.length; f++) {
		//air.trace(_files[f].nativePath);
		if (_files[f].isDirectory) {
			//air.trace(_files[f].nativePath);
			if (_files[f].name !="." && _files[f].name !="..") {
				//it's a directory
				getFilesRecursive(_files[f].nativePath);
			}
		} else {
			//it's a file yupeee
			fileList.push(_files[f].nativePath);
		}
	}
	

}

function doSelectUpload(_directory){

	if(typeof(_directory) === "undefined"){
		air.trace("bad directory");
		return;
	}
	if(_directory.nativePath.length < 3){
		air.trace("bad directory name length");
		return;
	}
	air.trace("doSelectUpload: attempt upload from directory: "+ _directory.name);
	
	//parse baby parse
	getFilesRecursive(_directory.nativePath);
	
	filecount = fileList.length;
	
	var localname = null;
	var configname = null;
	uploadcount = 0;
	files_checked_count = 0;
	
	
	blinkmessage('Processing...');
	loadingIndicator(true);
	var request = new air.URLRequest(UPLOAD_URL + ID_NUMBER);

	request.contentType = 'multipart/form-data';
	request.method = air.URLRequestMethod.POST;
	
	//fileList contains all the files in the selected drive,
	for (var f = 0; f < fileList.length; f++) {
		var this_file = new air.File(fileList[f]);
		
		localname = this_file.name.toLowerCase();
		
		//CONFIG_FILES_ARRAY contains all the files that we are looking for. populated by getConfig(CONFIG_URL);
		for (var lf = 0; lf < CONFIG_FILES_ARRAY.length; lf++) {
			
			
			var configname = CONFIG_FILES_ARRAY[lf].split("||")[0].toLowerCase();
			var matched = false;
			
			if(configname.indexOf("*") !== -1){
				//there is a wildcard we want to check to see if the name is in the string
				if (localname.indexOf(configname.split("*")[0]) != -1) {
					matched = true;
				}
			}else{
				//we want to do exact match
				if (localname.toLowerCase() === configname.toLowerCase()) {
					matched = true;
				}
			}
			
			//air.trace(config_filename);
			//##air.trace("comparing: "+localname+" to: "+configname );
			//iterating through files: if local file is the same as config file
			
			//air.trace("does: "+localname+" match: "+config_filename);
			if (matched) {
				still_looking = false;//this will tell auto upload that we are in the correct folder, do not search others
				//upload the file
				if(OFFLINE){
					air.trace("***upload: "+this_file.nativePath+" matched: "+configname);
					fileCompleteHandler();
					//uploading is an asynchronous event. when we get here, the file HAS been uploaded
					uploadcount++;
				}else{
					air.trace("***upload: "+this_file.nativePath+" matched: "+configname);
					this_file.upload(request, "AIRfile");
				
					this_file.addEventListener(air.IOErrorEvent.IO_ERROR, fileErrorHandler);
				
					//when we are done uploading, CALL fileCompleteHandler() callback function
					this_file.addEventListener(air.Event.COMPLETE, fileCompleteHandler);
					//uploading is an asynchronous process. uploadcount says, "hey this is how many files i've queued to be uploaded"
					uploadcount++;
				}
			}
			
		}//END for( var lf = 0; lf < CONFIG_FILES_ARRAY.length; lf++ ){
		increase_filechecked_count();
		
	}//END for( var f = 0; f < files.length; f++ )
	if (uploadcount == 0) {
		//directory=null;
		loadingIndicator(false);
		blinkmessage('No workout data found', true);
		$("#instructions")
			.text("Make sure your USB drive is inserted in your computer. Press Select USB Drive. Click on the drive name that corresponds to your USB drive.")
			.animate({opacity:1}, 2000);
		
		air.trace("doSelectUpload done, no uploads directory: "+ directory.name);
	}
	else {
	
		blinkmessage('Uploading workout data...', true);
		
		air.trace("doSelectUpload done, folder: "+ _directory.name+" count: "+ uploadcount);
		$('#upload').attr('disabled', null);
	}
	//reset fileList, incase we neeed to enumerate the files again for a different drive.
	fileList = [];
	//fileCompleteHandler();
}//doSelectUpload
function fileErrorHandler(event){
	//air.trace("A file IO error has occurred: "+event);
	alert("We're sorry, but there was a problem processing one of your workout files. Please try again. If the problem persists, please contact IHP Technical Support.");
	loadingIndicator(false);
}
function increase_filechecked_count(){
	files_checked_count++;
}
function increase_actually_uploaded_count(){
	files_actually_uploaded_count++;
}
function fileCompleteHandler(event){
	air.trace("file complete upload handler called root: "+ directory.name);
	//uploading is an asynchronous event. when we get here, a file HAS been uploaded
	increase_actually_uploaded_count();
	
	//if we have checked all the files in our files list then call process()
	if ((filecount === files_checked_count) && (uploadcount > 0) && !(called_process)) {
		air.trace("call process: filecount: "+filecount+" files_checked_count:"+files_checked_count);
		if(OFFLINE){
			//alert("processed all files... call process and delete files");
			processDeleteFiles();
			
			loadingIndicator(false);
			$("#instructions").text("USB Drive Found").animate({opacity:1}, 2000);
			$('#task').fadeOut('fast').delay(100).text('Personal data synched.').delay(100).fadeIn('fast');//.delay(5000).fadeOut('slow');
			blinkmessage('Personal data file downloaded.');
		}else{
			callProcess();
		}
		
	}
	
}

function Quit(){
	var event = new air.Event(air.Event.EXITING, false, true);
	air.NativeApplication.nativeApplication.dispatchEvent(event);
	if (!event.isDefaultPrevented()) {
		air.NativeApplication.nativeApplication.exit();
	}
}

function getConfig(config_url){
	air.trace("get config: "+ config_url);
	xml = new XMLHttpRequest();
	
	xml.onreadystatechange = function(){
		var elem = null;
		var filename = null;
		var should_i_delete = "FALSE";
		var getthesefiles = null;
		
		if (xml.readyState == 4) {
			getthesefiles = xml.responseXML.documentElement.getElementsByTagName('localfile');
			
			for (var c = 0; c < getthesefiles.length; c++) {
				filename = getthesefiles[c].getElementsByTagName('filename')[0].textContent;
				should_i_delete = getthesefiles[c].getElementsByTagName('deletefile')[0].textContent;
				
				
				CONFIG_FILES_ARRAY[c] = filename+"||"+should_i_delete;
				
			}
			
		}
	}
	
	xml.open('GET', config_url, true);
	xml.send(null);
	
	
}
//END getConfig(config_url)
function getIHPUSERFILE(){
	air.trace("get IHPUSERFILE:"+ IHPUSER_URL + ID_NUMBER+" downloading to: "+ directory.name);
	
	
	if(OFFLINE || got_IHPUSERFILE ){return;}
	
	var request = new air.URLRequest(IHPUSER_URL + ID_NUMBER);
	
	request.contentType = 'multipart/form-data';
	request.method = air.URLRequestMethod.POST;
	
	
	var loader = new air.URLLoader();
	loader.addEventListener(air.HTTPStatusEvent.HTTP_STATUS, function(e){
		//air.trace(e);
	});
	loader.addEventListener(air.IOErrorEvent, function(e){
		//air.trace(e);
		
		blinkmessage('No personal data found on the website. Please check your account information screen to make sure those details are present.', true);
	});
	loader.addEventListener(air.Event.COMPLETE, function(e){
		//air.trace( loader.data );
		
		
		var file = directory.resolvePath('IHPUSER.TXT');
		var stream = new air.FileStream();
		
		stream.openAsync(file, air.FileMode.WRITE);
		stream.writeMultiByte(loader.data, air.File.systemCharset);
		stream.close();
		
		air.trace("done ihpuser file");
		
		blinkmessage('Personal data file downloaded.');
		got_IHPUSERFILE = true;
		//loadingIndicator(false);
		
	});
	loader.load(request);
	
}//function getIHPUSERFILE
function callProcess(){
	called_process = true;
	air.trace("in callProcess: uploading from: "+ directory.name);
	air.trace("upload count: "+uploadcount+" - actually uploaded count: "+files_actually_uploaded_count);
	
	if(files_actually_uploaded_count < uploadcount){
		air.trace("process prematurely called uploads not completed yet, wait 5 seconds and retry...");
		setTimeout(callProcess, 5000);
		return;
	}

	air.trace(IHPPROCESS_URL + ID_NUMBER);
	
	var urlString = IHPPROCESS_URL + ID_NUMBER;
	var urlReq = new air.URLRequest(urlString);
	
	var urlStream = new air.URLLoader();
	//urlReq.idleTimeout = 30000; //wait 10 seconds for a response
	
	urlStream.addEventListener(air.HTTPStatusEvent.HTTP_STATUS, function(e){
		//air.trace(e);
	});
	urlStream.addEventListener(air.IOErrorEvent, function(e){
		alert("An error occurred: "+e);
	});
	urlStream.addEventListener(air.Event.COMPLETE, function(e){
		air.trace("call to process complete : "+ directory.name);
		
		processDeleteFiles();
		
		//air.trace("done... delete files now!");
		//AFTER the PROCESS URL HAS BEEN CALLED. DELETE FILES
		
		/*var files = directory.getDirectoryListing();
		
		//delete the files after all the uploads are complete
		for (var lf = 0; lf < CONFIG_FILES_ARRAY.length; lf++) {
			configname = CONFIG_FILES_ARRAY[lf][0];
			for (var f = 0; f < files.length; f++) {
				localname = files[f].name;
				if ((localname.toLowerCase() == configname.toLowerCase()) && (!files[f].isDirectory)) {
					//delete the file
					air.trace("delete: " + files[f].name);
					files[f].deleteFile();
				}
			}//END for( var f = 0; f < files.length; f++ )
		}//END for( var lf = 0; lf < CONFIG_FILES_ARRAY.length; lf++ ){
		*/
		
		//get IHPUSERFILE if we upload files, because we know we are in the correct directory
		getIHPUSERFILE();
		
		loadingIndicator(false);
		$("#instructions").text("USB Drive Found").animate({opacity:1}, 2000);
		$('#task').fadeOut('fast').delay(100).text('Personal data synched.').delay(100).fadeIn('fast');//.delay(5000).fadeOut('slow');
		
		//disable click events
		$("#upload, .drive_letters").bind("click", function(e){
			e.preventDefault();
			return false;
		}).css("color", "#ccc");
		WE_ARE_DONE = true;
		//blinkmessage('Personal data synched.', true);
		//alert("done");
	
	});//END urlStream.addEventListener(air.Event.COMPLETE, function(e){
	try{
		urlStream.load(urlReq);
	}
	catch (error){
		blinkmessage('Unable to contact server, retrying in 30 seconds...', true);
		air.trace("Unable to load URL");
		urlStream.load(urlReq);
		_timeoutTimer = new air.Timer(60000);//60 seconds
		_timeoutTimer.start();	
	}

	
}
function processDeleteFiles(){
	air.trace("PROCESS DELETE: "+ directory.nativePath);
	
	getFilesRecursive(directory.nativePath);
	
	filecount = fileList.length;
	
	var localname = null;
	var configname = null;
	uploadcount = 0;
	files_checked_count = 0;
	
	
	//fileList contains all the files in the selected drive,
	for (var f = 0; f < fileList.length; f++) {
		var this_file = new air.File(fileList[f]);
		
		localname = this_file.name.toLowerCase();
		
		//CONFIG_FILES_ARRAY contains all the files that we are looking for. populated by getConfig(CONFIG_URL);
		for (var lf = 0; lf < CONFIG_FILES_ARRAY.length; lf++) {
			
			
			var configname_and_delete = CONFIG_FILES_ARRAY[lf].split("||");
			var configname = configname_and_delete[0].toLowerCase();
			var should_i_delete = configname_and_delete[1];
			var matched = false;
			
			if(configname.indexOf("*") !== -1){
				//there is a wildcard we want to check to see if the name is in the string
				if (localname.indexOf(configname.split("*")[0]) != -1) {
					matched = true;
					if(should_i_delete === "TRUE"){
						air.trace("delete :"+ this_file.name);
						this_file.deleteFile();
					}
					
				}
			}else{
				//we want to do exact match
				if (localname.toLowerCase() === configname.toLowerCase()) {
					matched = true;
					if(should_i_delete === "TRUE"){
						air.trace("delete :"+ this_file.name);
						this_file.deleteFile();
					}
				}
			}
		}//END for (var lf = 0; lf < CONFIG_FILES_ARRAY.length; lf++) 
		files_checked_count++;
	}//END for (var f = 0; f < fileList.length; f++) 
	air.trace("delete: filecount: "+filecount+" files_checked_count:"+files_checked_count);	
}
//utility functions
function blinkmessage(msg, sticky, task){

	if (sticky) {
		$('#message').fadeOut('fast').delay(100).text(msg).delay(100).fadeIn('fast');
	}
	else {
		$('#message').fadeOut('fast').delay(100).text(msg).delay(100).fadeIn('fast').delay(3000).fadeOut('slow');
	}
	if (task) {
		$('#task').fadeOut('fast').delay(100).text(msg).delay(100).fadeIn('fast').delay(3000).fadeOut('slow');
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
