package com.gramhisab.app;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final int REQ_SPEECH = 101;
    private static final int REQ_SAVE_FILE = 102;
    private static final int REQ_OPEN_FILE = 103;
    private static final int REQ_MIC_PERMISSION = 104;
    private static final int REQ_PICK_CONTACT = 105;

    private WebView web;
    private TextToSpeech tts;
    private boolean ttsReady = false;
    // Web-update support: screens can be replaced by a newer downloaded copy in files/www/.
    private boolean loadedFromWww = false;
    private boolean appReady = false;
    private String rollbackNote = null;
    private SpeechRecognizer recognizer;
    private int recognizerRetries = 0;
    private String pendingLang = "en-IN";
    private String pendingSaveContent = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window w = getWindow();
        w.setStatusBarColor(Color.parseColor("#B45309"));
        w.setNavigationBarColor(Color.parseColor("#FFFFFF"));
        if (Build.VERSION.SDK_INT >= 26) {
            w.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        }

        // Lets chrome://inspect on a connected computer debug the app's screens.
        WebView.setWebContentsDebuggingEnabled(true);
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setTextZoom(100);
        s.setMediaPlaybackRequiresUserGesture(false);
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient());
        web.addJavascriptInterface(new Bridge(), "Android");
        setContentView(web);
        loadApp();

        tts = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                ttsReady = true;
                int r = tts.setLanguage(new Locale("en", "IN"));
                if (r < 0) tts.setLanguage(Locale.US);
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override public void onStart(String id) {}
                    @Override public void onDone(String id) { js("window.onSpeakDone && onSpeakDone(" + JSONObject.quote(id) + ")"); }
                    @Override public void onError(String id) { js("window.onSpeakDone && onSpeakDone(" + JSONObject.quote(id) + ")"); }
                });
            }
        });
    }

    private File wwwDir() { return new File(getFilesDir(), "www"); }

    private void loadApp() {
        appReady = false;
        File idx = new File(wwwDir(), "index.html");
        // A newer APK brings newer built-in screens: drop an older downloaded copy.
        if (idx.exists() && compareVersions(readText(new File(wwwDir(), "version.txt")), assetText("version.txt")) <= 0) deleteDir(wwwDir());
        loadedFromWww = idx.exists();
        if (loadedFromWww) {
            web.loadUrl("file://" + idx.getAbsolutePath());
            // Watchdog: if the downloaded screens fail to start, go back to the built-in ones.
            web.postDelayed(() -> {
                if (!appReady && loadedFromWww) {
                    rollbackNote = readText(new File(wwwDir(), "version.txt"));
                    deleteDir(wwwDir());
                    loadApp();
                }
            }, 12000);
        } else {
            web.loadUrl("file:///android_asset/index.html");
        }
    }

    private String assetText(String name) {
        try (InputStream is = getAssets().open(name)) { return readAll(is).trim(); } catch (Exception e) { return "0"; }
    }
    private static String readText(File f) {
        try (FileInputStream in = new FileInputStream(f)) { return readAll(in).trim(); } catch (Exception e) { return "0"; }
    }
    static int compareVersions(String a, String b) {
        String[] x = a.split("\\."), y = b.split("\\.");
        for (int i = 0; i < Math.max(x.length, y.length); i++) {
            int p = 0, q = 0;
            try { p = i < x.length ? Integer.parseInt(x[i].replaceAll("\\D", "")) : 0; } catch (Exception ignored) {}
            try { q = i < y.length ? Integer.parseInt(y[i].replaceAll("\\D", "")) : 0; } catch (Exception ignored) {}
            if (p != q) return p < q ? -1 : 1;
        }
        return 0;
    }

    private static void deleteDir(File f) {
        if (f == null || !f.exists()) return;
        File[] kids = f.listFiles();
        if (kids != null) for (File k : kids) deleteDir(k);
        f.delete();
    }

    private int nativeVersionCode() {
        try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionCode; } catch (Exception e) { return 0; }
    }

    private void js(final String code) {
        runOnUiThread(() -> { if (web != null) web.evaluateJavascript(code, null); });
    }

    // ---------------- Voice input ----------------

    private void startListening(String lang) {
        if (!lang.equals(pendingLang)) recognizerRetries = 0;
        pendingLang = lang;
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQ_MIC_PERMISSION);
            return;
        }
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            startIntentListening(lang);
            return;
        }
        try {
            if (recognizer != null) recognizer.destroy();
            recognizer = SpeechRecognizer.createSpeechRecognizer(this);
            recognizer.setRecognitionListener(new RecognitionListener() {
                @Override public void onReadyForSpeech(Bundle b) { voiceEvent("ready", null); }
                @Override public void onBeginningOfSpeech() { voiceEvent("speaking", null); }
                @Override public void onRmsChanged(float v) {}
                @Override public void onBufferReceived(byte[] b) {}
                @Override public void onEndOfSpeech() { voiceEvent("processing", null); }
                @Override public void onError(int error) {
                    // Retry the app's own listener instead of opening Google's voice popup.
                    if ((error == SpeechRecognizer.ERROR_CLIENT || error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY) && recognizerRetries < 2) {
                        recognizerRetries++;
                        if (recognizer != null) { recognizer.destroy(); recognizer = null; }
                        web.postDelayed(() -> startListening(pendingLang), 400);
                        return;
                    }
                    if (error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) { voiceEvent("error", "permission"); return; }
                    String msg;
                    switch (error) {
                        case SpeechRecognizer.ERROR_NO_MATCH: msg = "nomatch"; break;
                        case SpeechRecognizer.ERROR_SPEECH_TIMEOUT: msg = "timeout"; break;
                        case SpeechRecognizer.ERROR_NETWORK:
                        case SpeechRecognizer.ERROR_NETWORK_TIMEOUT: msg = "network"; break;
                        case SpeechRecognizer.ERROR_AUDIO: msg = "audio"; break;
                        default: msg = "error" + error;
                    }
                    voiceEvent("error", msg);
                }
                @Override public void onResults(Bundle results) {
                    recognizerRetries = 0;
                    deliverResults(results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION));
                }
                @Override public void onPartialResults(Bundle partial) {
                    ArrayList<String> p = partial.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    if (p != null && !p.isEmpty()) voiceEvent("partial", p.get(0));
                }
                @Override public void onEvent(int t, Bundle b) {}
            });
            recognizer.startListening(buildSpeechIntent(lang));
        } catch (Exception e) {
            startIntentListening(lang);
        }
    }

    private Intent buildSpeechIntent(String lang) {
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, lang);
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5);
        i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        i.putExtra(RecognizerIntent.EXTRA_PROMPT, "Speak now…");
        return i;
    }

    private void startIntentListening(String lang) {
        try {
            startActivityForResult(buildSpeechIntent(lang), REQ_SPEECH);
            voiceEvent("ready", null);
        } catch (ActivityNotFoundException e) {
            voiceEvent("error", "unavailable");
        }
    }

    private void deliverResults(ArrayList<String> list) {
        JSONArray arr = new JSONArray();
        if (list != null) for (String s : list) arr.put(s);
        js("window.onVoiceResult && onVoiceResult(" + arr.toString() + ")");
    }

    private void voiceEvent(String state, String data) {
        js("window.onVoiceState && onVoiceState(" + JSONObject.quote(state) + "," + (data == null ? "null" : JSONObject.quote(data)) + ")");
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        if (requestCode == REQ_MIC_PERMISSION) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) startListening(pendingLang);
            else voiceEvent("error", "permission");
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent); // app opened again from the icon: keep the same screen (and its data)
    }

    // ---------------- Activity results ----------------

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_SPEECH) {
            if (resultCode == RESULT_OK && data != null) {
                deliverResults(data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS));
            } else {
                voiceEvent("error", "cancelled");
            }
        } else if (requestCode == REQ_SAVE_FILE) {
            boolean ok = false;
            if (resultCode == RESULT_OK && data != null && data.getData() != null && pendingSaveContent != null) {
                try (OutputStream os = getContentResolver().openOutputStream(data.getData(), "wt")) {
                    os.write(pendingSaveContent.getBytes("UTF-8"));
                    ok = true;
                } catch (Exception e) { ok = false; }
            }
            pendingSaveContent = null;
            js("window.onFileSaved && onFileSaved(" + ok + ")");
        } else if (requestCode == REQ_PICK_CONTACT) {
            String name = null, phone = null;
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                try (android.database.Cursor c = getContentResolver().query(data.getData(),
                        new String[]{ android.provider.ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                                      android.provider.ContactsContract.CommonDataKinds.Phone.NUMBER }, null, null, null)) {
                    if (c != null && c.moveToFirst()) { name = c.getString(0); phone = c.getString(1); }
                } catch (Exception ignored) {}
            }
            js("window.onContactPicked && onContactPicked(" + (name == null ? "null" : JSONObject.quote(name)) + "," + (phone == null ? "null" : JSONObject.quote(phone)) + ")");
        } else if (requestCode == REQ_OPEN_FILE) {
            String text = null;
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                try (InputStream is = getContentResolver().openInputStream(data.getData())) {
                    text = readAll(is);
                } catch (Exception e) { text = null; }
            }
            js("window.onFileOpened && onFileOpened(" + (text == null ? "null" : JSONObject.quote(text)) + ")");
        }
    }

    private static String readAll(InputStream is) throws Exception {
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = is.read(buf)) > 0) bos.write(buf, 0, n);
        return bos.toString("UTF-8");
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.onBack ? String(onBack()) : 'false'", value -> {
            if (value == null || !value.contains("true")) finish();
        });
    }

    @Override
    protected void onPause() {
        super.onPause();
        js("window.onAppPause && onAppPause()");
    }

    @Override
    protected void onResume() {
        super.onResume();
        js("window.onAppResume && onAppResume()");
    }

    @Override
    protected void onDestroy() {
        if (recognizer != null) recognizer.destroy();
        if (tts != null) tts.shutdown();
        super.onDestroy();
    }

    // ---------------- JavaScript bridge ----------------

    private class Bridge {
        @JavascriptInterface
        public String load(String name) {
            File f = new File(getFilesDir(), safe(name));
            if (!f.exists()) return null;
            try (FileInputStream in = new FileInputStream(f)) {
                return readAll(in);
            } catch (Exception e) { return null; }
        }

        @JavascriptInterface
        public boolean save(String name, String content) {
            File dir = getFilesDir();
            File target = new File(dir, safe(name));
            File tmp = new File(dir, safe(name) + ".tmp");
            try (FileOutputStream out = new FileOutputStream(tmp)) {
                out.write(content.getBytes("UTF-8"));
                out.getFD().sync();
            } catch (Exception e) { return false; }
            if (target.exists()) {
                File bak = new File(dir, safe(name) + ".bak");
                bak.delete();
                target.renameTo(bak);
            }
            return tmp.renameTo(target);
        }

        @JavascriptInterface
        public void listen(final String lang) { runOnUiThread(() -> startListening(lang)); }

        @JavascriptInterface
        public void stopListening() { runOnUiThread(() -> { if (recognizer != null) recognizer.stopListening(); }); }

        @JavascriptInterface
        public void cancelListening() { runOnUiThread(() -> { if (recognizer != null) recognizer.cancel(); }); }

        @JavascriptInterface
        public boolean speak(String text, String id) {
            if (!ttsReady) return false;
            Bundle b = new Bundle();
            tts.speak(text, TextToSpeech.QUEUE_FLUSH, b, id);
            return true;
        }

        @JavascriptInterface
        public void stopSpeaking() { if (ttsReady) tts.stop(); }

        @JavascriptInterface
        public void http(final String url, final String body, final String cbId) {
            new Thread(() -> {
                int status = 0;
                String text;
                try {
                    String current = url;
                    String method = body == null ? "GET" : "POST";
                    String payload = body;
                    text = "";
                    for (int hop = 0; hop < 6; hop++) {
                        HttpURLConnection c = (HttpURLConnection) new URL(current).openConnection();
                        c.setInstanceFollowRedirects(false);
                        c.setConnectTimeout(20000);
                        c.setReadTimeout(45000);
                        c.setRequestMethod(method);
                        if (payload != null) {
                            c.setDoOutput(true);
                            c.setRequestProperty("Content-Type", "text/plain;charset=utf-8");
                            try (OutputStream os = c.getOutputStream()) { os.write(payload.getBytes("UTF-8")); }
                        }
                        status = c.getResponseCode();
                        if (status >= 300 && status < 400 && c.getHeaderField("Location") != null) {
                            current = new URL(new URL(current), c.getHeaderField("Location")).toString();
                            method = "GET";
                            payload = null;
                            c.disconnect();
                            continue;
                        }
                        InputStream is = status >= 400 ? c.getErrorStream() : c.getInputStream();
                        text = is == null ? "" : readAll(is);
                        c.disconnect();
                        break;
                    }
                } catch (Exception e) {
                    text = "ERROR: " + e.getMessage();
                }
                js("window.onHttp && onHttp(" + JSONObject.quote(cbId) + "," + status + "," + JSONObject.quote(text) + ")");
            }).start();
        }

        @JavascriptInterface
        public void saveFile(final String fileName, final String mime, final String content) {
            runOnUiThread(() -> {
                pendingSaveContent = content;
                Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType(mime);
                i.putExtra(Intent.EXTRA_TITLE, fileName);
                try { startActivityForResult(i, REQ_SAVE_FILE); }
                catch (ActivityNotFoundException e) { js("window.onFileSaved && onFileSaved(false)"); }
            });
        }

        @JavascriptInterface
        public void openFile() {
            runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");
                try { startActivityForResult(i, REQ_OPEN_FILE); }
                catch (ActivityNotFoundException e) { js("window.onFileOpened && onFileOpened(null)"); }
            });
        }

        @JavascriptInterface
        public void shareText(final String text) {
            runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_SEND);
                i.setType("text/plain");
                i.putExtra(Intent.EXTRA_TEXT, text);
                startActivity(Intent.createChooser(i, "Share"));
            });
        }

        @JavascriptInterface
        public void toast(final String msg) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, msg, Toast.LENGTH_SHORT).show());
        }

        @JavascriptInterface
        public String deviceName() {
            String name = null;
            try { name = Settings.Global.getString(getContentResolver(), "device_name"); } catch (Exception ignored) {}
            if (name == null || name.isEmpty()) name = Build.MANUFACTURER + " " + Build.MODEL;
            return name;
        }

        @JavascriptInterface
        public void openVoiceSettings() {
            runOnUiThread(() -> {
                try { startActivity(new Intent(Settings.ACTION_VOICE_INPUT_SETTINGS)); }
                catch (Exception e) {
                    try { startActivity(new Intent(Settings.ACTION_SETTINGS)); } catch (Exception ignored) {}
                }
            });
        }

        private String safe(String name) { return name.replaceAll("[^A-Za-z0-9._-]", "_"); }

        // ---------- moving from the old app ID (com.farm.chickenkhata) ----------
        @JavascriptInterface
        public String packageName() { return getPackageName(); }

        @JavascriptInterface
        public boolean isInstalled(String pkg) {
            try { getPackageManager().getPackageInfo(pkg, 0); return true; } catch (Exception e) { return false; }
        }

        // Reads the clipboard (only works while this app is on screen) to pick up the setup code.
        @JavascriptInterface
        public String readClipboard() {
            final String[] out = { null };
            final java.util.concurrent.CountDownLatch done = new java.util.concurrent.CountDownLatch(1);
            runOnUiThread(() -> {
                try {
                    android.content.ClipboardManager cm = (android.content.ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
                    if (cm != null && cm.hasPrimaryClip() && cm.getPrimaryClip().getItemCount() > 0) {
                        CharSequence t = cm.getPrimaryClip().getItemAt(0).coerceToText(MainActivity.this);
                        out[0] = t == null ? null : t.toString();
                    }
                } catch (Exception ignored) {}
                done.countDown();
            });
            try { done.await(2, java.util.concurrent.TimeUnit.SECONDS); } catch (InterruptedException ignored) {}
            return out[0];
        }

        @JavascriptInterface
        public void copyText(final String text) {
            runOnUiThread(() -> {
                try {
                    android.content.ClipboardManager cm = (android.content.ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
                    cm.setPrimaryClip(android.content.ClipData.newPlainText("Gram Hisab", text));
                } catch (Exception ignored) {}
            });
        }

        // Opens Android's own "Uninstall this app?" dialog (the user confirms).
        @JavascriptInterface
        public void uninstallPackage(final String pkg) {
            runOnUiThread(() -> {
                try { startActivity(new Intent(Intent.ACTION_DELETE, Uri.parse("package:" + pkg))); } catch (Exception ignored) {}
            });
        }

        @JavascriptInterface
        public boolean openApp(final String pkg) {
            Intent i = getPackageManager().getLaunchIntentForPackage(pkg);
            if (i == null) return false;
            runOnUiThread(() -> startActivity(i));
            return true;
        }

        // ---------- contacts (system picker: no contacts permission needed) ----------
        @JavascriptInterface
        public void pickContact() {
            runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_PICK, android.provider.ContactsContract.CommonDataKinds.Phone.CONTENT_URI);
                try { startActivityForResult(i, REQ_PICK_CONTACT); } catch (ActivityNotFoundException e) { js("window.onContactPicked && onContactPicked(null,null)"); }
            });
        }

        // Opens the phone's Contacts app with the name and number filled in; the user taps Save.
        @JavascriptInterface
        public void saveContact(final String name, final String phone) {
            runOnUiThread(() -> {
                Intent i = new Intent(android.provider.ContactsContract.Intents.Insert.ACTION);
                i.setType(android.provider.ContactsContract.RawContacts.CONTENT_TYPE);
                i.putExtra(android.provider.ContactsContract.Intents.Insert.NAME, name);
                i.putExtra(android.provider.ContactsContract.Intents.Insert.PHONE, phone);
                try { startActivity(i); } catch (Exception ignored) {}
            });
        }

        @JavascriptInterface
        public void callNumber(final String phone) {
            runOnUiThread(() -> {
                try { startActivity(new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + phone))); } catch (Exception ignored) {}
            });
        }

        // ---------- updater ----------
        @JavascriptInterface
        public void appReady() { appReady = true; }

        @JavascriptInterface
        public String rollbackNote() { String n = rollbackNote; rollbackNote = null; return n; }

        @JavascriptInterface
        public int nativeVersion() { return nativeVersionCode(); }

        @JavascriptInterface
        public String nativeVersionName() {
            try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; } catch (Exception e) { return ""; }
        }

        @JavascriptInterface
        public boolean usingDownloadedScreens() { return loadedFromWww; }

        // bundle = {"version": "1.8.1", "files": {"index.html": "...", "core.js": "..."}}
        @JavascriptInterface
        public boolean installWeb(String bundle) {
            try {
                JSONObject b = new JSONObject(bundle);
                JSONObject files = b.getJSONObject("files");
                if (!files.has("index.html")) return false;
                File tmp = new File(getFilesDir(), "www_new");
                deleteDir(tmp);
                tmp.mkdirs();
                java.util.Iterator<String> it = files.keys();
                while (it.hasNext()) {
                    String name = it.next();
                    String clean = safe(name);
                    if (!clean.equals(name)) return false;
                    try (FileOutputStream out = new FileOutputStream(new File(tmp, clean))) { out.write(files.getString(name).getBytes("UTF-8")); }
                }
                File live = wwwDir();
                deleteDir(live);
                return tmp.renameTo(live);
            } catch (Exception e) { return false; }
        }

        @JavascriptInterface
        public void resetWeb() { deleteDir(wwwDir()); }

        @JavascriptInterface
        public void reloadApp() { runOnUiThread(() -> loadApp()); }

        // Download a newer APK and open the installer (Android asks the user to confirm).
        @JavascriptInterface
        public void installApk(final String url) {
            new Thread(() -> {
                try {
                    File dir = new File(getCacheDir(), "apk");
                    dir.mkdirs();
                    File out = new File(dir, "update.apk");
                    String current = url;
                    for (int hop = 0; hop < 6; hop++) {
                        HttpURLConnection c = (HttpURLConnection) new URL(current).openConnection();
                        c.setInstanceFollowRedirects(false);
                        c.setConnectTimeout(20000);
                        c.setReadTimeout(60000);
                        int status = c.getResponseCode();
                        if (status >= 300 && status < 400 && c.getHeaderField("Location") != null) {
                            current = new URL(new URL(current), c.getHeaderField("Location")).toString();
                            c.disconnect();
                            continue;
                        }
                        if (status != 200) throw new Exception("HTTP " + status);
                        int total = c.getContentLength(), done = 0, n, lastPct = -1;
                        byte[] buf = new byte[16384];
                        try (InputStream in = c.getInputStream(); FileOutputStream fo = new FileOutputStream(out)) {
                            while ((n = in.read(buf)) > 0) {
                                fo.write(buf, 0, n); done += n;
                                int pct = total > 0 ? (int) (done * 100L / total) : -1;
                                if (pct != lastPct && pct % 10 == 0) { lastPct = pct; js("window.onApkProgress && onApkProgress(" + pct + ")"); }
                            }
                        }
                        c.disconnect();
                        break;
                    }
                    runOnUiThread(() -> {
                        if (Build.VERSION.SDK_INT >= 26 && !getPackageManager().canRequestPackageInstalls()) {
                            js("window.onApkProgress && onApkProgress(-2)");
                            try { startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getPackageName()))); } catch (Exception ignored) {}
                            return;
                        }
                        Intent i = new Intent(Intent.ACTION_VIEW);
                        i.setDataAndType(Uri.parse("content://" + getPackageName() + ".apk/update.apk"), "application/vnd.android.package-archive");
                        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                        try { startActivity(i); js("window.onApkProgress && onApkProgress(101)"); }
                        catch (Exception e) { js("window.onApkProgress && onApkProgress(-1)"); }
                    });
                } catch (Exception e) {
                    js("window.onApkProgress && onApkProgress(-1)");
                }
            }).start();
        }
    }
}
