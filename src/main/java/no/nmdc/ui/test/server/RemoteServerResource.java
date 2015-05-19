package no.nmdc.ui.test.server;

import com.google.common.io.ByteStreams;

import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.StreamingOutput;
import javax.ws.rs.core.UriInfo;
import java.io.InputStream;
import java.net.MalformedURLException;
import java.net.URI;
import java.net.URL;

/**
 * Created by IntelliJ IDEA.
 * User: ingekr
 * Date: 24.04.2015
 */
@Path("/")
public class RemoteServerResource {
    public static final String API_PATH = "metadata-api";

    private final String serverUrl;

    public RemoteServerResource(String aServerUrl) {
        serverUrl = aServerUrl;
    }

    @GET
    @Path("{request}")
    @Produces(MediaType.APPLICATION_JSON)
    public StreamingOutput getTotalDistance(@Context UriInfo aUriInfo) throws MalformedURLException {
        URI relativeUri = aUriInfo.getBaseUri().relativize(aUriInfo.getRequestUri());
        URL url = new URL(serverUrl + API_PATH + '/' + relativeUri);
        return out -> {
            try (InputStream in = url.openStream()) {
                ByteStreams.copy(in, out);
            }
        };
    }
}
