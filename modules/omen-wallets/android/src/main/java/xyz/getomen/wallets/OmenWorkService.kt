package xyz.getomen.wallets

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

/**
 * Keeps the app's process alive while the agent works. Android freezes a
 * backgrounded app's JavaScript within seconds; a foreground service with
 * an ongoing notification ("OMEN is researching…") tells the system the work
 * is the user's, so a turn that was started on screen finishes off screen.
 */
class OmenWorkService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val title = intent?.getStringExtra("title") ?: "OMEN"
    val text = intent?.getStringExtra("text") ?: "Working"
    val manager = getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(
        NotificationChannel(CHANNEL, "Agent", NotificationManager.IMPORTANCE_LOW).apply {
          description = "Shown while the agent is working on a reply"
          setShowBadge(false)
        },
      )
    }
    val launch = packageManager.getLaunchIntentForPackage(packageName)
    val open = launch?.let { PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_IMMUTABLE) }
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(this, CHANNEL) else @Suppress("DEPRECATION") Notification.Builder(this)
    val notification = builder
      .setContentTitle(title)
      .setContentText(text)
      .setSmallIcon(android.R.drawable.stat_notify_sync)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .apply { if (open != null) setContentIntent(open) }
      .build()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
    } else {
      startForeground(ID, notification)
    }
    return START_NOT_STICKY
  }

  companion object {
    const val CHANNEL = "omen-agent"
    const val ID = 4201
  }
}
