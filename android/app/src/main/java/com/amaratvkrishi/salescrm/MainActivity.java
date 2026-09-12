package com.amaratvkrishi.salescrm;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Keep DevTools available for debug builds while ensuring release APKs
        // cannot expose WebView contents to a host connected over ADB.
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
    }
}
