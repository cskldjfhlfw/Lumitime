if (navigator.appName == "Microsoft Internet Explorer" && parseInt(navigator.appVersion.split(";")[1].replace(/[ ]/g, "").replace("MSIE", "")) < 9) {
    location.href = contextPath + "/browsers.html";
}
var isshowright = document.getElementById("right");
$(document).ready(function () {
    init();
    initHead();
    initSendButton();
    initShow();
    if (!isMobileClient) {
        intiSize()
    }
});

function intiSize() {

    //获取当前浏览器窗口宽度(这里的实质就是body宽度)

    var fontSize = ((window.screen.width) / 100 + 1)
    //设置根元素的大小
    document.getElementsByTagName('html')[0].style.fontSize = fontSize + 'px';
    var loginwidth = $('.login').height()
    var realityheight = $('body').height()


    // $('.login').css({
    //     top:`calc((100vh - 9.4rem - 10.4rem - ${loginwidth}px)/2) !important`
    // })
    //document.querySelector('.login').style.top = `calc((${realityheight}px - 9.4rem - 8.4rem - ${loginwidth}px)/2)`
    document.querySelector('.login').style.top = 'calc((' + realityheight + 'px - 9.4rem - 8.4rem - ' + loginwidth + 'px)/2)'
    // document.querySelector('.login').style.top=
    //浏览器窗口宽度发生变化时条用这个函数，方便与改变窗口大小时候调试

}

$(window).resize(function () {
    if (!isMobileClient) {
        intiSize()
    }

});


function init() {
    if (document.getElementById("qqimg")) {
        document.getElementById("qqimg").title = "qq账号";
    }
    if (document.getElementById("weiboimg")) {
        document.getElementById("weiboimg").title = "微博账号";
    }
    if (!document.getElementById("qqimg") && !document.getElementById("weiboimg")) {
        document.getElementById("otherway").style.display = "none";
    }


    if (!$("#remark_text").text()) {
        $(".remark").hide();
    }
    if (!document.getElementById("msg1")) {
        if (document.getElementById("swiSpan1")) {
            document.getElementById("swiSpan1").style.display = "";
        }
    }
    if (!document.getElementById("msg2")) {
        if (document.getElementById("swiSpan2")) {
            document.getElementById("swiSpan2").style.display = "";
        }
    }
    if ($(".rememberdiv span").length > 0) {
        $(".rememberdiv span").on('click', function (event) {
            if ($('#rememberMe').prop("checked")) {
                $('#rememberMe').prop("checked", false);
            } else {
                $('#rememberMe').prop("checked", true);
            }
        });
    }
    var timer;
    $('.left').on('click', function (event) {
        clearInterval(timer);
        event.preventDefault();
        if (isshowright) {
            $(this).addClass("active");
        } else {
            $(this).removeClass("active");
        }
        $('.right').removeClass("active");
        $('.middle').removeClass("active");
        $('.left-login').show();
        $("#fm1").show();
        $("#fm2").hide();
        document.getElementById("swiSpan1").style.display = "";
        if (document.getElementById("msg1")) {
            document.getElementById("msg1").style.display = "none";
        }
    });

    $("#qrCode").attr('src', "");
    clearInterval(timer);
    $("#scanTip").html("请使用企业微信扫描登录");
    if ($("#muyuQrcode").innerHTML != undefined) {
        return
    }
    var qrcode_ticket = get_sso_qrcodeticket(); // 获取 token
    var muyudomain = muUrl + "/cgi-bin"; // 接口服务器地址由接口授权方提供
    var obj = new QrLogin({
        jsqrcode_ticket: qrcode_ticket,
        id: "muyuQrcode",
        ucode: muAppId,
        cgi_token: accessToken,
        scope: "snsapi_login",
        redirect_uri: "",
        state: "login",
        style: "white",
        href: "",
        domain: muyudomain
    });
    if (!qrcode_ticket) {
        qrcode_ticket = get_sso_qrcodeticket();
    }
    muyuUUIdCodeRequest(qrcode_ticket);

    //timer = setInterval(muyuUUIdRequest, 2000, qrcode_ticket, uuid, code)
    //timer = setInterval(muyuLoginRequest, 2000, uuid, code)


    $('.right').on('click', function (event) {
        event.preventDefault();
        $(this).addClass("active");
        $('.middle').removeClass("active");
        $('.left').removeClass("active");
        $('.left-login').show();
        $("#fm2").show();
        $("#fm1").hide();
        document.getElementById("swiSpan2").style.display = "";
        if (document.getElementById("msg2")) {
            document.getElementById("msg2").style.display = "none";
        }
    });
}

function initHead() {
    if (isshowright) {
        $("#fm2").hide();
    } else {
        $("#headid").hide();
        $(".left").removeClass("active");
    }

}

function initSendButton() {
    var send_obj = $('#send_button');
    send_obj.click(function () {
        if (send_obj.hasClass("disable")) {
            return
        }
        var $username = $("#request_username");
        var username = $username.val().replace(/\s/gi, "");
        if (isValid(username)) {//
            if (!isMobile(username)) {
                if (document.getElementById("msg2")) {
                    $("#msg2").html("");
                }
                $("#swiSpan2").html("手机号格式不正确！");
                $username.focus();
                return;
            }
            $.ajax({
                type: "post",
                url: contextPath + "/smsLogin/sendSms",
                dataType: "json",
                data: {
                    "request_username": username
                },
                success: function (result) {
                    if (result.success) {
                        start_sms_button(send_obj);
                        $("#swiSpan2").html("");
                    } else {
                        // alert(result.errormsg);
                        if (document.getElementById("msg2")) {
                            $("#msg2").html("");
                        }
                        $("#swiSpan2").html(result.errormsg);
                        $username.focus();
                    }
                }
            });
        } else {
            // alert("请输入绑定的手机号或者邮箱！");
            if (document.getElementById("msg2")) {
                $("#msg2").html("");
            }
            $("#swiSpan2").html("请输入绑定的手机号！");
            $username.focus();
        }
    });
}

//获取uuid 接口只获取一次
function muyuUUIdCodeRequest(qrcode_ticket) {
    $.ajax({
        url: muUrl + "/cgi-bin/wxlogin/getssouuid.php",
        type: "GET",
        data: {
            "request_id": requestId,
            "cgi_token": accessToken,
            "jsqrcode_ticket": qrcode_ticket
        },
        async: false,
        dataType: "jsonp",
        jsonpCallback: "getssouuid",
        contextType: "application/json",
        success: function (result) {
            if (result.errcode == 0) {
                var uuid = result.return.uuid;
                var code = result.return.code;
                setInterval(muyuLoginRequest, 2000, uuid, code)
            }
        }
    })
}

function muyuLoginRequest(uuid, code) {
    $.post(ajaxMuyuLoginUrl + "?uuid=" + uuid + "&code=" + code + "&request_id=" + requestId + "&accessToken=" + accessToken, {}, function (result) {
        if (result == "success") {
            document.location.href = document.location.href;
            //window.location.reload();
        } else if (result == "userlimit") {
            // alert("not one user login");
            // window.location.reload();
        } else if (result != "") {
            console.log(result)
            // alert("not one user login");
            // window.location.reload();
        } else if (result == "qrcode expire") {
            alert("二维码已过期！");
        } else if (result == "invalid qrcode") {
            alert("无效的二维码！");
        }
    }, "text");
}

/*function muyuUUIdRequest(qrcode_ticket) {
    $.ajax({
        url: muUrl + "/cgi-bin/wxlogin/getssouuid.php",
        type: "GET",
        async: false,
        data: {
            "request_id": requestId,
            "cgi_token": accessToken,
            "jsqrcode_ticket": qrcode_ticket
        },
        dataType: "jsonp",
        jsonpCallback: "getssouuid",
        contextType: "application/json",
        success: function (result) {
            if (result.errcode == 0) {
                var uuid = result.return.uuid;
                var code = result.return.code;
                $.post(ajaxMuyuLoginUrl + "?uuid=" + uuid + "&code=" + code + "&request_id=" + requestId + "&accessToken=" + accessToken, {}, function (result) {
                    if (result == "success") {
                        document.location.href = document.location.href;
                        //window.location.reload();
                    } else if (result == "userlimit") {
                        // alert("not one user login");
                        // window.location.reload();
                    } else if (result != "") {
                        console.log(result)
                        // alert("not one user login");
                        // window.location.reload();
                    }
                }, "text");
            }
        }
    })
}*/


function initShow() {
    if (isSmsLogin) {
        $(".right").addClass("active");
        $('.middle').removeClass("active");
        $('.left').removeClass("active");
        $('.left-login').show();
        $("#fm2").show();
        $("#fm1").hide();
        $('.qr-code').hide();
    }
}

function isValid(obj) {
    return obj != null && obj != '';
}

function isMobile(obj) {
    var regex = /^[1][3-9][0-9]{9}$/;
    return regex.test(obj);
}

function start_sms_button(obj) {
    var count = 0;
    var sum = 60;
    obj.addClass("disable").text(parseInt(sum - count) + '秒');
    var i = setInterval(function () {
        count++;
        if (count >= 60) {
            obj.text('获取验证码').removeClass("disable");
            clearInterval(i);
        } else {
            obj.text(parseInt(sum - count) + '秒');
        }
    }, 1000);
}

function loginRequest() {
    $.post(ajaxLoginUrl, {}, function (result) {
        if (result == "success") {
            document.location.href = document.location.href;
            //window.location.reload();
        } else if (result == "userlimit") {
            // alert("not one user login");
            // window.location.reload();
        }
    }, "text");
}

function refreshCaptcha(captcah) {
    var tmp = contextPath + "/captcha.jpg?tt=" + Math.random();
    captcah.src = tmp;
}

function checkDynamicLogin() {
    var request_username = $("#request_username").val();
    if (request_username == null || request_username == '') {
        var placeholder = $("#request_username").attr("placeholder");
        // alert("请输入您绑定的" + placeholder + "!");
        if (document.getElementById("msg2")) {
            $("#msg2").html("");
        }
        $("#swiSpan2").html("请输入您绑定的" + placeholder + "!");
        return false;
    }
    if (!isMobile(request_username)) {
        var placeholder = $("#request_username").attr("placeholder");
        // alert("请输入您绑定的" + placeholder + "!");
        if (document.getElementById("msg2")) {
            $("#msg2").html("");
        }
        $("#swiSpan2").html(placeholder + "格式不正确!");
        return false;
    }

    var smscode = $("#smscode").val();
    if (smscode == null || smscode == '') {
        // alert("请输入您收到动态验证码!");
        if (document.getElementById("msg2")) {
            $("#msg2").html("");
        }
        $("#swiSpan2").html("请输入您收到动态码!");
        return false;
    }
    $("#swiSpan2").html("");
    return true;
}

function checkPassLogin() {
    var username = $("#username").val();
    if (username == null || username == '') {
        // alert("请输入用户名!");
        if (document.getElementById("msg1")) {
            $("#msg1").html("");
        }
        $("#swiSpan1").html("请输入用户名!");
        return false;
    }
    var password = $("#password").val();
    if (password == null || password == '') {
        // alert("请输入用户密码!");
        if (document.getElementById("msg1")) {
            $("#msg1").html("");
        }
        $("#swiSpan1").html("请输入密码!");
        return false;
    }
    if (document.getElementById("authcode")) {
        var authcode = $("#authcode").val();
        if (authcode == null || authcode == '') {
            // alert("请输入验证码!");
            if (document.getElementById("msg1")) {
                $("#msg1").html("");
            }
            $("#swiSpan1").html("请输入验证码!");
            return false;
        }
    }

    if (document.getElementById("encrypted")) {
        var thisPwd = document.getElementById("password").value;
        if (thisPwd.length != 256) {
            RSAUtils.setMaxDigits(131);
            var key = RSAUtils.getKeyPair("010001", '', "008aed7e057fe8f14c73550b0e6467b023616ddc8fa91846d2613cdb7f7621e3cada4cd5d812d627af6b87727ade4e26d26208b7326815941492b2204c3167ab2d53df1e3a2c9153bdb7c8c2e968df97a5e7e01cc410f92c4c2c2fba529b3ee988ebc1fca99ff5119e036d732c368acf8beba01aa2fdafa45b21e4de4928d0d403");
            var result = RSAUtils.encryptedString(key, thisPwd);
            $("#password").val(result);
        }
    }
    $("#swiSpan1").html("");
    return true;
}

function toqqLogin() {
    var iHeight = 400;
    var iWidth = 800;
    var iTop = (window.screen.height - 30 - iHeight) / 2; //获得窗口的垂直位置;
    var iLeft = (window.screen.width - 10 - iWidth) / 2; //获得窗口的水平位置;
    //以下为按钮点击事件的逻辑。注意这里要重新打开窗口
    //否则后面跳转到QQ登录，授权页面时会直接缩小当前浏览器的窗口，而不是打开新窗口
    var A = window.open(qqAuthorizeURL, "TencentLogin",
        "width=" + iWidth + ",height=" + iHeight + ",top=" + iTop + ",left=" + iLeft + ",menubar=0,scrollbars=1,resizable=1,status=1,titlebar=0,toolbar=0,location=1");
}

function toweiboLogin() {
    var iHeight = 400;
    var iWidth = 800;
    var iTop = (window.screen.height - 30 - iHeight) / 2; //获得窗口的垂直位置;
    var iLeft = (window.screen.width - 10 - iWidth) / 2; //获得窗口的水平位置;
    //以下为按钮点击事件的逻辑。注意这里要重新打开窗口
    //否则后面跳转到QQ登录，授权页面时会直接缩小当前浏览器的窗口，而不是打开新窗口
    var A = window.open(wbAuthorizeURL, "weiboLogin",
        "width=" + iWidth + ",height=" + iHeight + ",top=" + iTop + ",left=" + iLeft + ",menubar=0,scrollbars=1,resizable=1,status=1,titlebar=0,toolbar=0,location=1");
}
