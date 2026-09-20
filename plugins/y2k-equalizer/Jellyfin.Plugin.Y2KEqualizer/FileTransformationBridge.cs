using System.Reflection;
using System.Runtime.Loader;
using Newtonsoft.Json.Linq;

namespace Jellyfin.Plugin.Y2KEqualizer;

public static class FileTransformationBridge
{
    public static bool Register()
    {
        Type? pluginInterface = FindPluginInterface();
        MethodInfo? register = pluginInterface?.GetMethod("RegisterTransformation");
        if (register is null)
        {
            return false;
        }

        JObject payload = new()
        {
            { "id", Plugin.PluginId.ToString() },
            { "fileNamePattern", "index.html" },
            { "callbackAssembly", typeof(FileTransformationBridge).Assembly.FullName },
            { "callbackClass", typeof(IndexTransformation).FullName },
            { "callbackMethod", nameof(IndexTransformation.Transform) }
        };
        register.Invoke(null, new object[] { payload });
        return true;
    }

    public static void Remove()
    {
        Type? pluginInterface = FindPluginInterface();
        pluginInterface?.GetMethod("RemoveTransformation")?.Invoke(null, new object[] { Plugin.PluginId });
    }

    private static Type? FindPluginInterface()
    {
        Assembly? assembly = AssemblyLoadContext.All
            .SelectMany(context => context.Assemblies)
            .FirstOrDefault(candidate =>
                candidate.FullName?.Contains(".FileTransformation", StringComparison.Ordinal) == true);
        return assembly?.GetType("Jellyfin.Plugin.FileTransformation.PluginInterface");
    }
}

