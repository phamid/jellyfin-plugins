using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;

namespace Jellyfin.Plugin.Y2KEqualizer;

public sealed class Plugin : BasePlugin<PluginConfiguration>
{
    public static readonly Guid PluginId = Guid.Parse("ea773275-27eb-461a-bd86-962b091ff796");

    public Plugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer)
        : base(applicationPaths, xmlSerializer)
    {
        Instance = this;
    }

    public static Plugin? Instance { get; private set; }

    public override string Name => "Y2K Equalizer + Visualizer";

    public override string Description =>
        "A 2000s-inspired 10-band equalizer and real-time visualizer for Jellyfin Web.";

    public override Guid Id => PluginId;

    public override void OnUninstalling()
    {
        FileTransformationBridge.Remove();
        base.OnUninstalling();
    }
}

public sealed class PluginConfiguration : BasePluginConfiguration
{
}
