var API_HostName, urlParams, API_ObjectParams, recordCreateUrl, recordParams = {},
    api_version = '39.0';

//utility functions 
/**
 * Convert the URL passed into readable JSON object.
 * @param {string} url 
 */
function getUrlVars(url) {
    var hash;
    var myJson = {};
    var hashes = url.slice(url.indexOf('?') + 1).split('&');
    for (var i = 0; i < hashes.length; i++) {
        hash = hashes[i].split('=');
        myJson[hash[0]] = hash[1];
    }
    return myJson;
}
/**
 * get the cookies from the browser to get session id
 */
function getCookies() {
    var pairs = document.cookie.split(";");
    var cookies = {};
    for (var i = 0; i < pairs.length; i++) {
        var pair = pairs[i].split("=");
        cookies[pair[0].trim()] = unescape(pair[1]);
    }
    return cookies;
}

/**
 * Set the values of the Global variables used in this page. We need the url parameters and the API name to be set to the right server for the HTTP callouts to lapi.
 */
function setGlobalVars() {
    return new Promise(function (resolve, reject) {
        try {
            API_HostName = window.location.protocol + '//' + window.location.hostname.split('.')[0].split('--')[0] + '.my.salesforce.com';
            urlParams = getUrlVars(window.location.search);
            Object.keys(urlParams).forEach(function (paramkey) {
                if (paramkey.startsWith('record_')) {
                    if (paramkey.endsWith('_label')) {
                        var fieldlabel = paramkey.substring('record_'.length, paramkey.length - '_label'.length);
                        if (recordParams.hasOwnProperty(fieldlabel))
                            recordParams[fieldlabel].label = urlParams[paramkey];
                        else
                            recordParams[fieldlabel] = {
                                label: urlParams[paramkey]
                            };
                    }
                    if (paramkey.endsWith('_value')) {
                        var fieldlabel = paramkey.substring('record_'.length, paramkey.length - '_value'.length);
                        if (recordParams.hasOwnProperty(fieldlabel))
                            recordParams[fieldlabel].value = urlParams[paramkey];
                        else
                            recordParams[fieldlabel] = {
                                value: urlParams[paramkey]
                            };
                    }
                }
            });
            cookies = getCookies();
            API_ObjectParams = {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + cookies.sid
                }
            };
            console.log(API_ObjectParams);
            recordCreateUrl = API_HostName + '/services/data/v' + api_version + '/lapi/record-defaults/create/' + urlParams.objectName;
            resolve();
        } catch (ex) {
            reject(ex);
        }
    });
}

/**
 * Get the picklist values from lapi
 * @param {string} picklist_url 
 */
function getPicklistValues(picklist_url) {
    return fetch(MAIN_URL + picklist_url, obj)
        .then(function (res) {
            return res.json();
        });
}

/**
 * Get the recordInfo based on the createurl generated globally.
 */
function getRecordInfo() {
    return new Promise(function (resolve, reject) {
        fetch(recordCreateUrl, API_ObjectParams)
            .then(function (res) {
                return res.json();
            })
            .then(function (resJson) {
                console.log(resJson);
                picklistfields = {};
                resJson['recordObject'] = recordParams;
                resJson.recordObject.sobjectType = resJson.objectInfo.apiName;
                resJson.layout.sections.forEach(function (section) {
                    section.layoutRows.forEach(function (layoutRow) {
                        layoutRow.layoutItems.forEach(function (layoutItem) {
                            layoutItem.layoutComponents.forEach(function (layoutComponent) {
                                var fieldDef = resJson.objectInfo.fields[layoutComponent.value];
                                layoutComponent.fieldType = fieldDef.dataType;
                                layoutComponent.picklistValuesUrls = Object.values(fieldDef.picklistValuesUrls)[0];
                                if (layoutComponent.fieldType === 'Picklist') {
                                    picklistfields[layoutComponent.value] = layoutComponent.picklistValuesUrls;
                                }
                            });
                        });
                    });
                });

                if (Object.keys(picklistfields).length > 0) {
                    Promise.all(Object.values(picklistfields).map(getPicklistValues))
                        .then(function (r) {
                            resJson.layout.sections.forEach(function (section) {
                                section.layoutRows.forEach(function (layoutRow) {
                                    layoutRow.layoutItems.forEach(function (layoutItem) {
                                        layoutItem.layoutComponents.forEach(function (layoutComponent) {
                                            if (layoutComponent.fieldType === 'Picklist') {
                                                layoutComponent.isPicklist = true;
                                                layoutComponent.picklistValues = r.filter(function (eachpicklistresponse) {
                                                    return eachpicklistresponse.url == layoutComponent.picklistValuesUrls;
                                                })[0];
                                            } else
                                                layoutComponent.isPicklist = false;
                                        });
                                    });
                                });
                            });
                            resolve(resJson);
                        });
                }

            })
            .catch(function (err) {
                reject(err);
            });
    });
}

/**
 * Use Lightning out to create a component
 * @param {object} lapiObject 
 */
function passToLightning(lapiObject) {
    return new Promise(function (resolve, reject) {
        $Lightning.use('c:PrefillQuickAction_Out', function () {
            $Lightning.createComponent('c:CreateRecord', lapiObject, 'lightning', function (cmp, error, statusmessage) {
                if (statusmessage === 'SUCCESS')
                    resolve();
                else
                    reject(error);
            });
        });
    });
}

/**
 * redirect to previous functionality.
 */
function redirect() {
    console.log(params.retUrl);
    sforce.one.navigateToSObject(urlParams.parentId, urlParams.parentSobject);
}

setGlobalVars()
    .then(getRecordInfo)
    .then(passToLightning)
    .catch(function (error) {
        console.log(error);
        alert(error, 'we will display a beautiful message later');
    });