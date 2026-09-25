package xyz.getomen.wallets

import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.net.Uri
import android.util.Base64
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream

class OmenWalletsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("OmenWallets")
    AsyncFunction("getInstalledWallets") {
      val context = requireNotNull(appContext.reactContext)
      val pm = context.packageManager
      val intent = Intent(Intent.ACTION_VIEW, Uri.parse("solana-wallet:/v1/associate"))
        .addCategory(Intent.CATEGORY_BROWSABLE)
      val wallets = linkedMapOf<String, Map<String, Any?>>()
      @Suppress("DEPRECATION")
      val matches = pm.queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY)
      for (match in matches) {
        val activity = match.activityInfo
        val app = activity.applicationInfo
        if (activity.exported && activity.enabled && app.enabled && app.packageName != context.packageName) {
          wallets[app.packageName] = walletInfo(pm, app, "mwa")
        }
      }
      // These documented deep-link adapters also cover versions without MWA.
      for (packageName in listOf("app.phantom", "com.solflare.mobile", "app.backpack.mobile")) {
        if (wallets.containsKey(packageName)) continue
        try {
          @Suppress("DEPRECATION")
          val app = pm.getApplicationInfo(packageName, 0)
          if (app.enabled) wallets[packageName] = walletInfo(pm, app, "deeplink")
        } catch (_: PackageManager.NameNotFoundException) { /* Not installed. */ }
      }
      wallets.values.toList()
    }
  }

  private fun walletInfo(pm: PackageManager, app: ApplicationInfo, transport: String): Map<String, Any?> {
    val icon = runCatching {
      val drawable = pm.getApplicationIcon(app)
      val bitmap = Bitmap.createBitmap(96, 96, Bitmap.Config.ARGB_8888)
      drawable.setBounds(0, 0, 96, 96)
      drawable.draw(Canvas(bitmap))
      val stream = ByteArrayOutputStream()
      bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)
      bitmap.recycle()
      "data:image/png;base64," + Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
    }.getOrNull()
    return mapOf(
      "packageName" to app.packageName,
      "name" to pm.getApplicationLabel(app).toString(),
      "icon" to icon,
      "transport" to transport,
      "isSystem" to (app.flags and (ApplicationInfo.FLAG_SYSTEM or ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) != 0)
    )
  }
}
