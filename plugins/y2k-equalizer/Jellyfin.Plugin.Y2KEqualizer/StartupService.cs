using MediaBrowser.Model.Tasks;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Y2KEqualizer;

public sealed class StartupService : IScheduledTask
{
    private readonly ILogger<StartupService> _logger;

    public StartupService(ILogger<StartupService> logger)
    {
        _logger = logger;
    }

    public string Name => "Y2K Equalizer + Visualizer Startup";

    public string Key => "Y2KEqualizerStartup";

    public string Description => "Registers the authenticated Jellyfin Web player extension.";

    public string Category => "Startup Services";

    public Task ExecuteAsync(IProgress<double> progress, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (FileTransformationBridge.Register())
        {
            _logger.LogInformation("Registered the Y2K Equalizer + Visualizer web transformation.");
        }
        else
        {
            _logger.LogError(
                "File Transformation is unavailable. Install and enable it, then restart Jellyfin.");
        }

        progress.Report(100);
        return Task.CompletedTask;
    }

    public IEnumerable<TaskTriggerInfo> GetDefaultTriggers()
    {
        yield return new TaskTriggerInfo
        {
            Type = TaskTriggerInfoType.StartupTrigger
        };
    }
}

