import NetworkExtension

class AdBlockerNetworkExtension: NEPacketTunnelProvider {

    override func startTunnel(options: [String : NSObject]?, completionHandler: @escaping (Error?) -> Void) {
        NSLog("[Aegis iOS Shield] Initiating secure Packet Tunnel Extension...")

        // 1. Define virtual network settings
        let tunnelSettings = NEPacketTunnelNetworkSettings(tunnelRemoteAddress: "10.0.0.1")
        
        // 2. Configure IPv4 routing (intercept all device-wide outgoing traffic)
        let ipv4Settings = NEIPv4Settings(addresses: ["10.0.0.2"], subnetMasks: ["255.255.255.255"])
        ipv4Settings.includedRoutes = [NEIPv4Route.default()]
        tunnelSettings.ipv4Settings = ipv4Settings
        
        // 3. Set ad-blocking secure public DNS resolvers
        // This blocks ad domains system-wide across all iOS apps and games for $0!
        let dnsSettings = NEDNSSettings(servers: ["94.140.14.14", "94.140.15.15"])
        dnsSettings.matchDomains = [""] // Match all outgoing domains
        tunnelSettings.dnsSettings = dnsSettings

        // 4. Apply configurations and arm the local tunnel
        setTunnelNetworkSettings(tunnelSettings) { error in
            if let err = error {
                NSLog("[Aegis iOS Shield] Error arming tunnel network: \(err.localizedDescription)")
                completionHandler(err)
            } else {
                NSLog("[Aegis iOS Shield] iOS Packet Tunnel successfully armed and running.")
                completionHandler(nil)
            }
        }
    }

    override func stopTunnel(with reason: NEProviderStopReason, completionHandler: @escaping () -> Void) {
        NSLog("[Aegis iOS Shield] Disarming iOS Packet Tunnel...")
        completionHandler()
    }
}
