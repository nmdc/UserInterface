package no.nmdc.ui.test.server;

import com.google.common.io.ByteStreams;

import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.StreamingOutput;
import java.io.InputStream;
import java.nio.file.Files;

/**
 * Created by IntelliJ IDEA.
 * User: ingekr
 * Date: 24.04.2015
 */
@Path("/")
public class LocalFilesResource {
    private final java.nio.file.Path directory;

    public LocalFilesResource(java.nio.file.Path aDirectory) {
        directory = aDirectory;
    }

    @GET
    @Path("{request}")
    @Produces(MediaType.APPLICATION_JSON)
    public StreamingOutput getTotalDistance(@PathParam("request") String aRequest) throws InterruptedException {
        if (aRequest.equals("search")) Thread.sleep(1000); // Simulate server response time
        return out -> {
            try (InputStream in = Files.newInputStream(directory.resolve(aRequest + ".json"))) {
                ByteStreams.copy(in, out);
            }
        };
    }
}
