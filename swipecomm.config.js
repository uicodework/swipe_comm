module.exports = {  
    name: 'swipe_communication',
  
    script: 'index.ts',
    interpreter: 'node',
    //nterpreter_args: '--import tsx',
    watch: true,
    watch_delay: 3000,
    exec_mode: 'cluster',
    instances: 1,
    out_file: "./out.log",
    error_file: "./error.log",
    merge_logs: true,
    log_date_format: "DD-MM HH:mm:ss Z",
    log_type: "json",
    // other PM2 configuration options
  }