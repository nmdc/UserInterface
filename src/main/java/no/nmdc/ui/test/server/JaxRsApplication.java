package no.nmdc.ui.test.server;

import org.glassfish.jersey.jackson.JacksonFeature;
import org.glassfish.jersey.server.ResourceConfig;
import org.glassfish.jersey.server.ServerProperties;

/**
 * Created by IntelliJ IDEA.
 * User: ingekr
 * Date: 24.04.2015
 */
public class JaxRsApplication extends ResourceConfig {
    public JaxRsApplication(Object aResource) {
        property(ServerProperties.RESPONSE_SET_STATUS_OVER_SEND_ERROR, true);
        register(aResource);
        register(JacksonFeature.class);
        register(ErrorMessageExceptionMapper.class);
    }
}
