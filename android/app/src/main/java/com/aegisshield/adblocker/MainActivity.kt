package com.aegisshield.adblocker

import android.content.Intent
import android.net.VpnService
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import android.widget.ToggleButton
import androidx.appcompat.app.AppCompatActivity
import com.aegisshield.adblocker.service.AdBlockerVpnService
import com.aegisshield.adblocker.ui.SocialWebWrapperActivity

class MainActivity : AppCompatActivity() {

    private lateinit var toggleButton: ToggleButton
    private lateinit var statusText: TextView
    private lateinit var socialWrapperBtn: Button
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Setup direct programmatically styled layouts for zero-dependency portability
        val mainLayout = android.widget.LinearLayout(this).apply {
            orientation = android.widget.LinearLayout.VERTICAL
            gravity = android.view.Gravity.CENTER
            setPadding(50, 50, 50, 50)
            setBackgroundColor(android.graphics.Color.parseColor("#080b11"))
        }

        val titleText = TextView(this).apply {
            text = "AEGIS AI MOBILE"
            textSize = 24f
            setTextColor(android.graphics.Color.parseColor("#00f0ff"))
            gravity = android.view.Gravity.CENTER
            setPadding(0, 0, 0, 40)
        }

        statusText = TextView(this).apply {
            text = "SHIELD STATUS: INACTIVE"
            textSize = 16f
            setTextColor(android.graphics.Color.parseColor("#ff0055"))
            gravity = android.view.Gravity.CENTER
            setPadding(0, 0, 0, 60)
        }

        toggleButton = ToggleButton(this).apply {
            textOn = "DISARM SHIELD"
            textOff = "ARM AEGIS SHIELD"
            isChecked = false
            setBackgroundColor(android.graphics.Color.parseColor("#1a1d24"))
            setTextColor(android.graphics.Color.WHITE)
        }

        socialWrapperBtn = Button(this).apply {
            text = "OPEN AD-FREE SOCIAL MEDIA"
            setBackgroundColor(android.graphics.Color.parseColor("#00f0ff"))
            setTextColor(android.graphics.Color.parseColor("#080b11"))
            setPadding(20, 20, 20, 20)
        }
        
        // Layout spacings
        val params = android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply {
            setMargins(0, 30, 0, 30)
        }

        mainLayout.addView(titleText)
        mainLayout.addView(statusText)
        mainLayout.addView(toggleButton, params)
        mainLayout.addView(socialWrapperBtn, params)

        setContentView(mainLayout)

        // Set Listeners
        toggleButton.setOnCheckedChangeListener { _, isChecked ->
            if (isChecked) {
                startAdBlocker()
            } else {
                stopAdBlocker()
            }
        }

        socialWrapperBtn.setOnClickListener {
            startActivity(Intent(this, SocialWebWrapperActivity::class.java))
        }
    }

    private fun startAdBlocker() {
        // Request system permission to create VPN interface
        val intent = VpnService.prepare(this)
        if (intent != null) {
            startActivityForResult(intent, VPN_REQUEST_CODE)
        } else {
            connectVpn()
        }
    }

    private fun connectVpn() {
        val vpnIntent = Intent(this, AdBlockerVpnService::class.java)
        startService(vpnIntent)
        
        statusText.text = "SHIELD STATUS: ACTIVE"
        statusText.setTextColor(android.graphics.Color.parseColor("#00f5d4"))
        toggleButton.isChecked = true
        
        Toast.makeText(this, "Aegis Tunnel Activated", Toast.LENGTH_SHORT).show()
    }

    private fun stopAdBlocker() {
        val vpnIntent = Intent(this, AdBlockerVpnService::class.java)
        stopService(vpnIntent)
        
        statusText.text = "SHIELD STATUS: INACTIVE"
        statusText.setTextColor(android.graphics.Color.parseColor("#ff0055"))
        toggleButton.isChecked = false
        
        Toast.makeText(this, "Aegis Tunnel Deactivated", Toast.LENGTH_SHORT).show()
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == VPN_REQUEST_CODE && resultCode == RESULT_OK) {
            connectVpn()
        } else {
            toggleButton.isChecked = false
            Toast.makeText(this, "VPN permission denied", Toast.LENGTH_SHORT).show()
        }
    }

    companion object {
        private const val VPN_REQUEST_CODE = 1024
    }
}
