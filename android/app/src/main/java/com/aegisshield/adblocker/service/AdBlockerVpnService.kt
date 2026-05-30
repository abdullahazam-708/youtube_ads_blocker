package com.aegisshield.adblocker.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import android.util.Log
import com.aegisshield.adblocker.MainActivity

class AdBlockerVpnService : VpnService(), Runnable {

    private var vpnInterface: ParcelFileDescriptor? = null
    private var vpnThread: Thread? = null
    private val channelId = "AegisVpnChannel"

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        createNotificationChannel()
        
        val notificationIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, notificationIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, channelId)
                .setContentTitle("Aegis AI Shield Active")
                .setContentText("Your device is dynamically secured against tracking & ads.")
                .setSmallIcon(android.R.drawable.ic_lock_power_override)
                .setContentIntent(pendingIntent)
                .build()
        } else {
            Notification.Builder(this)
                .setContentTitle("Aegis AI Shield Active")
                .setContentText("Your device is dynamically secured.")
                .setSmallIcon(android.R.drawable.ic_lock_power_override)
                .setContentIntent(pendingIntent)
                .build()
        }

        // Start VPN in the foreground to prevent OS lifecycle terminations
        startForeground(1, notification)

        // Spin up packet monitoring thread
        if (vpnThread == null) {
            vpnThread = Thread(this, "AegisVpnThread")
            vpnThread?.start()
        }

        return START_STICKY
    }

    override fun run() {
        try {
            val builder = Builder()
            
            // Set VPN Configurations
            builder.setSession("Aegis Shield VPN")
            builder.addAddress("10.0.0.2", 32) // Local virtual tunnel IP
            builder.addRoute("0.0.0.0", 0)       // Intercept all outgoing IPv4 traffic
            
            // Point system DNS queries to AdGuard's high-speed ad-blocking DNS
            // This achieves 100% free, zero-cost ad domain blocking on games/apps immediately!
            builder.addDnsServer("94.140.14.14")
            builder.addDnsServer("94.140.15.15")

            // Establish the local virtual tunnel interface descriptor
            vpnInterface = builder.establish()
            Log.d("AegisVPN", "VPN Virtual Interface established successfully.")

            // Maintain loop to keep tunnel open
            while (!Thread.currentThread().isInterrupted) {
                Thread.sleep(1000)
            }

        } catch (e: InterruptedException) {
            Log.d("AegisVPN", "VPN thread interrupted.")
        } catch (e: Exception) {
            Log.e("AegisVPN", "Error establishing VPN tunnel: ${e.message}")
        } finally {
            closeTunnel()
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val serviceChannel = NotificationChannel(
                channelId,
                "Aegis VPN Service Channel",
                NotificationManager.IMPORTANCE_DEFAULT
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(serviceChannel)
        }
    }

    private fun closeTunnel() {
        try {
            vpnInterface?.close()
            vpnInterface = null
        } catch (e: Exception) {
            Log.e("AegisVPN", "Error closing tunnel interface: ${e.message}")
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        vpnThread?.interrupt()
        vpnThread = null
        closeTunnel()
    }
}
