(function(window) {
  function addEvent(el, event, handler) {
    var events = event.split(/\s+/);
    for (var i = 0; i < events.length; i++) {
      if (el.addEventListener) {
        el.addEventListener(events[i], handler);
      } else {
        el.attachEvent('on' + events[i], handler);
      }
    }
  }
  function removeEvent(el, event, handler) {
    var events = event.split(/\s+/);
    for (var i = 0; i < events.length; i++) {
      if (el.removeEventListener) {
        el.removeEventListener(events[i], handler);
      } else {
        el.detachEvent('on' + events[i], handler);
      }
    }
  }
  function getCssProperty(el, prop) {
    if (window.getComputedStyle) {
      return window.getComputedStyle(el, '').getPropertyValue(prop) || null;
    } else if (el.currentStyle) {
      return el.currentStyle[prop] || null;
    }
    return null;
  }

  var getWidgetsOrigin = function() {
    var link = document.createElement('A');
    link.href = document.currentScript && document.currentScript.src || 'https://comments.app';
    var origin = link.origin || link.protocol + '//' + link.hostname;
    return origin;
  };

  var getPageCanonical = function() {
    var link, href;
    if (document.querySelector) {
      link = document.querySelector('link[rel="canonical"]');
      if (link && (href = link.getAttribute('href'))) {
        return href;
      }
    } else {
      var links = document.getElementsByTagName('LINK');
      for (var i = 0; i < links.length; i++) {
        if ((link = links[i]) &&
            (link.getAttribute('rel').toLowerCase() == 'canonical') &&
            (href = link.getAttribute('href'))) {
          return href;
        }
      }
    }
    return location.origin + location.pathname + location.search;
  };

  var getPageMeta = function() {
    var meta, name, value, result = {};
    var metas = document.getElementsByTagName('META');
    for (var i = 0; i < metas.length; i++) {
      meta = metas[i];
      name = meta.getAttribute('name');
      if (!name) name = meta.getAttribute('property');
      if (!name) name = meta.getAttribute('itemprop');
      if (!name) continue;
      value = meta.getAttribute('content');
      if (!value) value = meta.getAttribute('value');
      if (!value) continue;
      result[name] = value;
    }
    return result;
  };

  var getPageTitle = function() {
    var meta = getPageMeta();
    var title = meta['twitter:title'];
    if (!title) title = meta['og:title'];
    if (!title) {
      var title_tag = false, heads, titles;
      if (document.querySelector) {
        title_tag = document.querySelector('head title');
      } else {
        heads = document.getElementsByTagName('HEAD');
        if (heads[0]) {
          titles = heads[0].getElementsByTagName('TITLE');
          title_tag = titles[0];
        }
      }
      if (title_tag) {
        title = title_tag.innerText;
      }
    }
    return title || '';
  };

  var getCommentHash = function() {
    var parts = location.hash.split('#');
    if (parts.length > 1) {
      var hash = parts.pop();
      var hash_parts = decodeURIComponent(hash).split('/');
      var threadId, commentId;
      if (hash_parts.length == 2 &&
          (threadId = hash_parts[0]) &&
          /^[A-Za-z0-9\-_]{8,16}$/.test(threadId) &&
          (commentId = parseInt(hash_parts[1]))) {
        return threadId + '/' + commentId;
      }
    }
    return false;
  };

  if (!window._CommentsAppWidgetUuid) {
    window._CommentsAppWidgetUuid = 0;
  }

  function initWidget(widgetEl) {
    var widgetId, widgetElId, widgetsOrigin, existsEl,
        src, styles = {}, allowedAttrs = [],
        defWidth, defHeight, onInitAuthUser, onAuthUser, onUnauth;
    if (!widgetEl.tagName ||
        !(widgetEl.tagName.toUpperCase() == 'SCRIPT')) {
      return null;
    }
    if (websiteId = widgetEl.getAttribute('data-comments-app-website')) {
      widgetsOrigin = getWidgetsOrigin();
      widgetElId = 'comments-app-' + websiteId.replace(/[^a-z0-9_]/ig, '-') + '-' + (++window._CommentsAppWidgetUuid);
      var websitePageUrl = widgetEl.getAttribute('data-page-url');
      if (!websitePageUrl) {
        websitePageUrl = getPageCanonical();
      }
      var websitePageTitle = widgetEl.getAttribute('data-page-title');
      if (!websitePageTitle) {
        websitePageTitle = getPageTitle();
      }
      var websitePageId = widgetEl.getAttribute('data-page-id');
      var websiteOrigin = location.origin || location.protocol + '//' + location.hostname;
      var websiteCommentId = getCommentHash();
      src = widgetsOrigin + '/embed/view?website=' + encodeURIComponent(websiteId) + (websitePageId ? '&page_id=' + encodeURIComponent(websitePageId) : '') + '&page_url=' + encodeURIComponent(websitePageUrl) + '&origin=' + encodeURIComponent(websiteOrigin) + (websitePageTitle ? '&page_title=' + encodeURIComponent(websitePageTitle) : '') + (websiteCommentId ? '&comment_id=' + encodeURIComponent(websiteCommentId) : '');
      allowedAttrs = ['limit', 'color', 'colorful', 'dark', 'dislikes', 'outlined', 'width', 'height'];
      defWidth = widgetEl.getAttribute('data-width') || '100%';
      defHeight = widgetEl.getAttribute('data-height') || 0;
    }
    else {
      return null;
    }
    existsEl = document.getElementById(widgetElId);
    if (existsEl) {
      return existsEl;
    }
    for (var i = 0; i < allowedAttrs.length; i++) {
      var attr = allowedAttrs[i];
      var novalue = attr.substr(-1) == '?';
      if (novalue) {
        attr = attr.slice(0, -1);
      }
      var data_attr = 'data-' + attr.replace(/_/g, '-');
      if (widgetEl.hasAttribute(data_attr)) {
        var attr_value = novalue ? '1' : encodeURIComponent(widgetEl.getAttribute(data_attr));
        src += '&' + attr + '=' + attr_value;
      }
    }
    function visibilityHandler() {
      try {
        if (isVisible(iframe, 50)) {
          var data = {event: 'visible', frame: widgetElId};
          iframe.contentWindow.postMessage(JSON.stringify(data), '*');
          // console.log('send', data);
        }
      } catch(e) {}
    }
    function postMessageHandler(event) {
      if (event.source !== iframe.contentWindow ||
          event.origin != widgetsOrigin) {
        return;
      }
      try {
        var data = JSON.parse(event.data);
      } catch(e) {
        var data = {};
      }
      if (data.event == 'resize') {
        if (data.height) {
          iframe.style.height = data.height + 'px';
        }
        if (data.width) {
          iframe.style.width = data.width + 'px';
        }
      }
      else if (data.event == 'visible_off') {
        removeEvent(window, 'scroll', visibilityHandler);
        removeEvent(window, 'resize', visibilityHandler);
      }
      else if (data.event == 'scroll_to') {
        try {
          window.scrollTo(0, iframe.getBoundingClientRect().top + window.pageYOffset + data.y);
        } catch(e) {}
      }
    }
    var iframe = document.createElement('iframe');
    iframe.id = widgetElId;
    iframe.src = src;
    iframe.width = defWidth;
    iframe.height = defHeight;
    iframe.setAttribute('frameborder', '0');
    if (!defHeight) {
      iframe.setAttribute('scrolling', 'no');
      iframe.style.overflow = 'hidden';
    }
    iframe.style.border = 'none';
    for (var prop in styles) {
      iframe.style[prop] = styles[prop];
    }
    if (widgetEl.parentNode) {
      widgetEl.parentNode.insertBefore(iframe, widgetEl);
    }
    addEvent(iframe, 'load', function() {
      removeEvent(iframe, 'load', visibilityHandler);
      addEvent(window, 'scroll', visibilityHandler);
      addEvent(window, 'resize', visibilityHandler);
      visibilityHandler();
    });
    addEvent(window, 'message', postMessageHandler);
    return iframe;
  }
  function isVisible(el, padding) {
    var node = el, val;
    var visibility = getCssProperty(node, 'visibility');
    if (visibility == 'hidden') return false;
    while (node) {
      if (node === document.documentElement) break;
      var display = getCssProperty(node, 'display');
      if (display == 'none') return false;
      var opacity = getCssProperty(node, 'opacity');
      if (opacity !== null && opacity < 0.1) return false;
      node = node.parentNode;
    }
    if (el.getBoundingClientRect) {
      padding = +padding || 0;
      var rect = el.getBoundingClientRect();
      var html = document.documentElement;
      if (rect.bottom < padding ||
          rect.right < padding ||
          rect.top > (window.innerHeight || html.clientHeight) - padding ||
          rect.left > (window.innerWidth || html.clientWidth) - padding) {
        return false;
      }
    }
    return true;
  }
  if (!document.currentScript ||
      !initWidget(document.currentScript)) {
    var widgets;
    if (document.querySelectorAll) {
      widgets = document.querySelectorAll('script[data-comments-app-website]');
    } else {
      widgets = Array.prototype.slice.apply(document.getElementsByTagName('SCRIPT'));
    }
    for (var i = 0; i < widgets.length; i++) {
      initWidget(widgets[i]);
    }
  }
})(window);