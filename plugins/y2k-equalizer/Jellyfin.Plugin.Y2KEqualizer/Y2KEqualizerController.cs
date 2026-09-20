using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.Y2KEqualizer;

[ApiController]
[Route("Y2KEqualizer")]
public sealed class Y2KEqualizerController : ControllerBase
{
    [HttpGet("client.js")]
    [Authorize]
    [Produces("application/javascript")]
    public ActionResult GetClientScript()
    {
        Stream? stream = Assembly.GetExecutingAssembly()
            .GetManifestResourceStream("Jellyfin.Plugin.Y2KEqualizer.Resources.y2k-equalizer.js");
        if (stream is null)
        {
            return NotFound();
        }

        Response.Headers.CacheControl = "public, max-age=31536000, immutable";
        return new FileStreamResult(stream, "application/javascript");
    }
}

