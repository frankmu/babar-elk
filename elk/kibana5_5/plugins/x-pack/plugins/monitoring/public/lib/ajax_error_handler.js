export function ajaxErrorHandlersProvider(Notifier, kbnUrl, Promise) {
  return (err) => {
    if (err.status === 403) {
      /* redirect to error message view */
      kbnUrl.redirect('access-denied');
    } else {
      const genericNotifier = new Notifier({ location: 'Monitoring' });
      genericNotifier.fatal(err);
    }

    return Promise.reject(err);
  };
};
