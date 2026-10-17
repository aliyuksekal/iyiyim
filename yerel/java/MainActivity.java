package com.matali.iyiyim;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(IyiyimPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
