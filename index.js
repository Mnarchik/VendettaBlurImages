const metro = window.vendetta?.metro || window.bunny?.metro;
const storage = window.vendetta?.plugin?.storage || window.bunny?.plugin?.storage;

let unpatchImage, unpatchGuildMenu, unpatchDMMenu;

export default {
    onLoad() {
        if (!metro || !storage) return;
        const { patcher, webpack } = metro;
        const { React, stylesheet } = metro.common;
        
        const ContextMenuComponents = webpack.findByProps("MenuItem", "MenuGroup");
        const GuildContextMenu = webpack.find(m => m?.default?.displayName === "GuildContextMenu" || m?.default?.name === "GuildContextMenu");
        const DMContextMenu = webpack.find(m => m?.default?.displayName === "ChannelReceiveMessageContextMenu" || m?.default?.name === "ChannelReceiveMessageContextMenu" || m?.default?.displayName === "DMContextMenu");

        if (!storage.blurredServers) storage.blurredServers = []; 
        if (!storage.blurredGroups) storage.blurredGroups = [];

        const styles = stylesheet.create({
            blurContainer: { position: "relative", overflow: "hidden", borderRadius: 8 },
            blurredImage: { filter: "blur(25px)", transform: "scale(1.05)" },
            blurOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 10 },
            overlayText: { color: "#ffffff", fontWeight: "bold", backgroundColor: "rgba(0,0,0,0.7)", padding: "8px 16px", borderRadius: 20, fontSize: 14 }
        });

        // 1. IMAGE BLUR PATCH
        const ImageAttachment = webpack.findByDisplayName("ImageAttachment", false);
        if (ImageAttachment) {
            unpatchImage = patcher.after("render", ImageAttachment, ([props], res) => {
                const guildId = props?.message?.guild_id;
                const channelId = props?.message?.channel_id;
                
                const shouldBlur = (guildId && storage.blurredServers.includes(guildId)) || 
                                   (channelId && storage.blurredGroups.includes(channelId));

                if (shouldBlur) {
                    const [isRevealed, setIsRevealed] = React.useState(false);
                    if (isRevealed) return res;

                    return React.createElement("div", { className: styles.blurContainer, onClick: () => setIsRevealed(true) },
                        React.createElement("div", { className: styles.blurOverlay },
                            React.createElement("span", { className: styles.overlayText }, "👁️ Click to unblur")
                        ),
                        React.createElement("div", { className: styles.blurredImage }, res)
                    );
                }
                return res;
            });
        }

        // 2. SERVER MENU PATCH
        if (GuildContextMenu && ContextMenuComponents) {
            const { MenuItem, MenuGroup } = ContextMenuComponents;
            unpatchGuildMenu = patcher.after("default", GuildContextMenu, ([props], res) => {
                const guildId = props?.guild?.id;
                if (!guildId) return res;

                const isCurrentlyBlurred = storage.blurredServers.includes(guildId);
                const toggleItem = React.createElement(MenuItem, {
                    label: isCurrentlyBlurred ? "Unblur Media in Server" : "Blur Media in Server",
                    id: "toggle-server-media-blur",
                    action: () => {
                        if (isCurrentlyBlurred) {
                            storage.blurredServers = storage.blurredServers.filter(id => id !== guildId);
                        } else {
                            storage.blurredServers.push(guildId);
                        }
                    }
                });

                if (res?.props?.children) {
                    const targetArray = Array.isArray(res.props.children) ? res.props.children : [res.props.children];
                    targetArray.push(React.createElement(MenuGroup, {}, toggleItem));
                }
                return res;
            });
        }

        // 3. GROUP CHAT MENU PATCH
        if (DMContextMenu && ContextMenuComponents) {
            const { MenuItem, MenuGroup } = ContextMenuComponents;
            unpatchDMMenu = patcher.after("default", DMContextMenu, ([props], res) => {
                const channelId = props?.channel?.id;
                if (!channelId) return res;

                const isCurrentlyBlurred = storage.blurredGroups.includes(channelId);
                const toggleItem = React.createElement(MenuItem, {
                    label: isCurrentlyBlurred ? "Unblur Media in Chat" : "Blur Media in Chat",
                    id: "toggle-group-media-blur",
                    action: () => {
                        if (isCurrentlyBlurred) {
                            storage.blurredGroups = storage.blurredGroups.filter(id => id !== channelId);
                        } else {
                            storage.blurredGroups.push(channelId);
                        }
                    }
                });

                if (res?.props?.children) {
                    const targetArray = Array.isArray(res.props.children) ? res.props.children : [res.props.children];
                    targetArray.push(React.createElement(MenuGroup, {}, toggleItem));
                }
                return res;
            });
        }
    },

    onUnload() { 
        if (unpatchImage) unpatchImage(); 
        if (unpatchGuildMenu) unpatchGuildMenu(); 
        if (unpatchDMMenu) unpatchDMMenu(); 
    }
};
