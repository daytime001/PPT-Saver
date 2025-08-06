(function (xhr) {

    var Promise = window.Promise;

    function createDownloadButton() {
        var nav = document.querySelector("#app > div:nth-child(2) > div.view-classroom > div > div.classroom-layout > div.classroom-nav");
        var old = document.querySelector("#app > div:nth-child(2) > div.view-classroom > div > div.classroom-layout > div.classroom-nav > span");

        // 创建下载按钮，默认使用小文件模式
        var button = document.createElement("button");
        button.innerText = "下载PDF"
        button.style.cssText = "margin-left: 16px;--dialog-body-max-height: 466.364px;-webkit-font-smoothing: antialiased;list-style: none;list-style-type: none;font: inherit;vertical-align: baseline;font-family: Roboto,Helvetica,Arial,sans-serif;-webkit-tap-highlight-color: rgba(0,0,0,0);-webkit-user-select: none;line-height: 1;white-space: nowrap;cursor: pointer;border: 1px solid #dadce0;-webkit-appearance: none;text-align: center;box-sizing: border-box;outline: 0;transition: .1s;font-weight: 500;font-size: 12px;border-radius: 3px;padding: 9px 15px;display: block;color: #ffffff;background: #4285f4;border-color: #b3cefb;";
        button.onclick = function () { downloadFile('medium'); }; // 默认使用小文件模式

        nav.removeChild(nav.lastElementChild);
        nav.appendChild(button);
    }

    function downloadFile(quality) {
        quality = quality || 'medium'; // 默认小文件模式

        var img_data = window.img_data;
        if (!img_data || img_data.length === 0) {
            alert("未找到PPT数据，请刷新页面后重试");
            return;
        }

        var title = img_data[1] && img_data[1].task ? img_data[1].task.title : "课堂派PPT";

        // 显示下载进度提示
        var button = document.querySelector("#app > div:nth-child(2) > div.view-classroom > div > div.classroom-layout > div.classroom-nav > button");
        var originalText = button.innerText;
        button.innerText = "正在生成PDF...";
        button.disabled = true;

        // 创建一个数组来存储所有图片的Promise
        var imagePromises = [];

        for (let i in img_data) {
            var url = img_data[i].src;
            imagePromises.push(loadImageAsDataURL(url, quality));
        }

        // 等待所有图片加载完成
        Promise.all(imagePromises).then(function (imageDataUrls) {
            button.innerText = "生成PDF中...";
            generatePDF(imageDataUrls, title, quality);

            // 恢复按钮状态
            setTimeout(function () {
                button.innerText = originalText;
                button.disabled = false;
            }, 2000);
        }).catch(function (error) {
            console.error("加载图片时出错:", error);
            alert("下载失败，请重试。错误信息：" + error.message);

            // 恢复按钮状态
            button.innerText = originalText;
            button.disabled = false;
        });
    }

    function loadImageAsDataURL(url, quality) {
        return new Promise(function (resolve, reject) {
            var img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = function () {
                var canvas = document.createElement('canvas');
                var ctx = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                // 根据质量级别设置不同的压缩参数
                var jpegQuality;
                var suffix = '';

                switch (quality) {
                    case 'medium':
                        jpegQuality = 0.75; // 中等质量，更小文件
                        suffix = '_compressed';
                        break;
                    case 'low':
                        jpegQuality = 0.6;  // 低质量，最小文件
                        suffix = '_small';
                        break;
                    case 'high':
                    default:
                        jpegQuality = 0.92; // 高质量，较小文件
                        break;
                }

                var dataUrl = canvas.toDataURL('image/jpeg', jpegQuality);

                resolve({
                    dataUrl: dataUrl,
                    width: img.width,
                    height: img.height,
                    format: 'JPEG',
                    quality: quality,
                    suffix: suffix
                });
            };
            img.onerror = function () {
                reject(new Error("无法加载图片: " + url));
            };
            img.src = url;
        });
    }

    function generatePDF(imageDataUrls, title, quality) {
        if (imageDataUrls.length === 0) {
            alert("没有找到图片数据");
            return;
        }

        // 找到最大的图片尺寸作为PDF页面大小，确保所有图片都能完整显示
        var maxWidth = 0;
        var maxHeight = 0;
        imageDataUrls.forEach(function (imageData) {
            if (imageData.width > maxWidth) maxWidth = imageData.width;
            if (imageData.height > maxHeight) maxHeight = imageData.height;
        });

        var pageWidth = maxWidth * 0.75; // 转换为点(points)，1px ≈ 0.75pt
        var pageHeight = maxHeight * 0.75;

        // 创建PDF文档，使用统一的页面大小
        // jsPDF 3.0+ 的正确用法
        if (!window.jspdf || !window.jspdf.jsPDF) {
            alert("PDF生成库未正确加载，请刷新页面重试");
            return;
        }

        var { jsPDF } = window.jspdf;

        // 根据质量级别调整PDF设置
        var pdfOptions = {
            orientation: pageWidth > pageHeight ? 'landscape' : 'portrait',
            unit: 'pt',
            format: [pageWidth, pageHeight],
            compress: true  // 始终启用PDF压缩
        };

        // 根据质量调整精度
        if (quality === 'medium') {
            pdfOptions.precision = 1; // 更低精度，更小文件
        } else if (quality === 'low') {
            pdfOptions.precision = 0; // 最低精度，最小文件
        } else {
            pdfOptions.precision = 2; // 默认精度
        }

        var pdf = new jsPDF(pdfOptions);

        // 添加每张图片到PDF
        imageDataUrls.forEach(function (imageData, index) {
            if (index > 0) {
                // 为后续页面添加新页面，使用统一的页面大小
                pdf.addPage([pageWidth, pageHeight]);
            }

            // 计算图片在页面中的居中位置
            var imgWidth = imageData.width * 0.75;
            var imgHeight = imageData.height * 0.75;
            var x = (pageWidth - imgWidth) / 2;
            var y = (pageHeight - imgHeight) / 2;

            // 添加图片到当前页面，保持原始大小并居中显示
            // 使用JPEG格式以减小文件大小
            pdf.addImage(imageData.dataUrl, 'JPEG', x, y, imgWidth, imgHeight);
        });

        // 生成文件名并下载
        var filename = title.replace(".pptx", "").replace(".ppt", "");
        pdf.save(filename + ".pdf");
    }


    var XHR = XMLHttpRequest.prototype;

    var open = XHR.open;
    var send = XHR.send;
    var setRequestHeader = XHR.setRequestHeader;

    XHR.open = function (method, url) {
        this._method = method; this._url = url;
        this._requestHeaders = {};
        this._startTime = (new Date()).toISOString();
        return open.apply(this, arguments);
    };

    XHR.setRequestHeader = function (header, value) {
        this._requestHeaders[header] = value;
        return setRequestHeader.apply(this, arguments);
    };

    XHR.send = function (postData) {
        this.addEventListener('load', function () {
            var responseHeaders = this.getAllResponseHeaders();
            if (this._url.match("PrestudyTaskApi/preStudyList") == null) return;
            if (this.responseType != 'blob' && this.responseText) {
                try {
                    var arr = this.responseText;
                    var response_data = JSON.parse(arr);
                    var img_data = response_data.data.data;
                    window.img_data = img_data;
                    createDownloadButton();
                    console.log(response_data);

                } catch (err) {
                    console.log("Error in response try catch");
                    console.log(err);
                }
            }
        });

        return send.apply(this, arguments);
    };

})(XMLHttpRequest);