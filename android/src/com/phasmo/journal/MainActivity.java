package com.phasmo.journal;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.ValueCallback;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {

    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        web = new WebView(this);
        web.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
        web.setBackgroundColor(Color.parseColor("#140d07"));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setTextZoom(100);

        web.setWebViewClient(new WebViewClient());
        web.setLongClickable(false);
        web.setHapticFeedbackEnabled(false);

        setContentView(web);
        web.loadUrl("file:///android_asset/index.html");
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        // 交给网页自己处理：先关浮层，再退上一页；返回 "handled" 表示已消费
        web.evaluateJavascript("(window.__onBack && window.__onBack()) || 'exit'",
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String value) {
                        if (value == null || !value.contains("handled")) {
                            finish();
                        }
                    }
                });
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.loadUrl("about:blank");
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
