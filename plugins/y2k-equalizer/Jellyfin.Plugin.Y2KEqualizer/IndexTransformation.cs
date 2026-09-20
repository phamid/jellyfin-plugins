namespace Jellyfin.Plugin.Y2KEqualizer;

public static class IndexTransformation
{
    private const string Marker = "<!-- Y2K Equalizer + Visualizer -->";

    private const string Loader = """
        <!-- Y2K Equalizer + Visualizer -->
        <script>
        (() => {
            'use strict';
            const loadY2KPlayer = () => {
                if (!window.ApiClient ||
                    typeof window.ApiClient.getCurrentUserId !== 'function' ||
                    !window.ApiClient.getCurrentUserId() ||
                    !window.ApiClient.serverInfo) {
                    return;
                }
                clearInterval(authTimer);
                ApiClient.fetch({
                    url: ApiClient.getUrl('Y2KEqualizer/client.js?v=0.3.0'),
                    type: 'GET',
                    dataType: 'text'
                }).then((scriptText) => {
                    const script = document.createElement('script');
                    script.textContent = scriptText;
                    document.head.appendChild(script);
                }).catch((error) => console.error('[Y2K Player] Failed to load.', error));
            };
            const authTimer = setInterval(loadY2KPlayer, 300);
        })();
        </script>
        """;

    public static string Transform(PatchRequest request)
    {
        if (string.IsNullOrEmpty(request.Contents) ||
            request.Contents.Contains(Marker, StringComparison.Ordinal))
        {
            return request.Contents;
        }

        return request.Contents.Replace("</body>", $"{Loader}</body>", StringComparison.OrdinalIgnoreCase);
    }
}
