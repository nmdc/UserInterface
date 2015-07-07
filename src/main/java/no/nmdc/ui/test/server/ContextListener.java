package no.nmdc.ui.test.server;

import org.glassfish.jersey.servlet.ServletContainer;

import javax.servlet.ServletContextEvent;
import javax.servlet.ServletContextListener;
import javax.servlet.annotation.WebListener;

/**
 * Created by IntelliJ IDEA.
 * User: ingekr
 * Date: 07.07.2015
 */
@WebListener
public class ContextListener implements ServletContextListener {
    public ContextListener() {
    }

    @Override
    public void contextInitialized(ServletContextEvent aServletContextEvent) {
        String serverUrl = System.getProperty(ServerMain.SERVER_URL_PROPERTY);
        aServletContextEvent.getServletContext().addServlet("UserInterfaceServlet", new ServletContainer(new JaxRsApplication(new RemoteServerResource(serverUrl))))
                .addMapping("/" + RemoteServerResource.API_PATH + "/*");
    }

    @Override
    public void contextDestroyed(ServletContextEvent aServletContextEvent) {
    }
}
