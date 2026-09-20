using Xunit;

namespace Jellyfin.Plugin.Y2KEqualizer.Tests;

public sealed class IndexTransformationTests
{
    [Fact]
    public void TransformInjectsAuthenticatedLoaderOnce()
    {
        const string original = "<html><body><main>Jellyfin</main></body></html>";

        string transformed = IndexTransformation.Transform(new PatchRequest { Contents = original });
        string secondPass = IndexTransformation.Transform(new PatchRequest { Contents = transformed });

        Assert.Contains("<!-- Y2K Equalizer + Visualizer -->", transformed, StringComparison.Ordinal);
        Assert.Contains("getCurrentUserId()", transformed, StringComparison.Ordinal);
        Assert.Contains("Y2KEqualizer/client.js?v=0.3.0", transformed, StringComparison.Ordinal);
        Assert.Equal(transformed, secondPass);
    }

    [Fact]
    public void TransformLeavesNonHtmlPayloadUnchanged()
    {
        const string content = "const value = 42;";

        string transformed = IndexTransformation.Transform(new PatchRequest { Contents = content });

        Assert.Equal(content, transformed);
    }

    [Fact]
    public void TransformDoesNotExposePlayerBeforeAuthentication()
    {
        string transformed = IndexTransformation.Transform(
            new PatchRequest { Contents = "<body></body>" });

        int authCheck = transformed.IndexOf("getCurrentUserId()", StringComparison.Ordinal);
        int clientRequest = transformed.IndexOf("Y2KEqualizer/client.js", StringComparison.Ordinal);
        Assert.True(authCheck >= 0);
        Assert.True(clientRequest > authCheck);
        Assert.DoesNotContain("y2k-equalizer-launcher", transformed, StringComparison.Ordinal);
        Assert.DoesNotContain("window.__y2k", transformed, StringComparison.Ordinal);
    }
}
