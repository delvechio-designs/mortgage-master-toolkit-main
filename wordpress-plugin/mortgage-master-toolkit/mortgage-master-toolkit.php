<?php
/**
 * Plugin Name: Mortgage Master Toolkit
 * Description: Embeds the app via [mortgage_master_toolkit]. Supports Vite dev server (HMR) and production build fallback.
 * Version: 1.1.0
 * Author: Delvechio Designs
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * License: GPLv2 or later
 */

if ( ! defined( 'ABSPATH' ) ) { exit; }

define( 'MMT_PLUGIN_FILE', __FILE__ );
define( 'MMT_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'MMT_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

// ----- Configure your Vite dev server origin (matches your vite.config.ts) -----
function mmt_dev_server_origin() { return 'http://localhost:8080'; }

function mmt_is_dev_server_running( $host = '127.0.0.1', $port = 8080, $timeout = 0.2 ) {
  $fp = @fsockopen( $host, $port, $errno, $errstr, $timeout );
  if ( $fp ) { fclose( $fp ); return true; }
  return false;
}

function mmt_should_use_dev() {
  $forced = isset( $_GET['mmt_dev'] ) && $_GET['mmt_dev'] === '1';
  $debug  = ( defined( 'SCRIPT_DEBUG' ) && SCRIPT_DEBUG ) || ( defined( 'WP_DEBUG' ) && WP_DEBUG );

  $origin = mmt_dev_server_origin();
  $parts  = wp_parse_url( $origin );
  $host   = $parts['host'] ?? '127.0.0.1';
  $port   = $parts['port'] ?? 8080;

  $running = mmt_is_dev_server_running( $host, (int) $port );
  return ( ( $debug || $forced ) && $running );
}

function mmt_enqueue_assets() {
  if ( ! did_action( 'mmt_should_enqueue' ) ) { return; }

  if ( mmt_should_use_dev() ) {
    $origin = rtrim( mmt_dev_server_origin(), '/' );
    wp_enqueue_script('mmt-vite-client', $origin . '/@vite/client', array(), null, true);
    wp_script_add_data('mmt-vite-client', 'type', 'module');

    wp_enqueue_script('mmt-app', $origin . '/src/main.tsx', array(), null, true);
    wp_script_add_data('mmt-app', 'type', 'module');
    return;
  }

  $manifest_path = MMT_PLUGIN_DIR . 'dist/.vite/manifest.json';
  if ( ! file_exists( $manifest_path ) ) { return; }
  $manifest = json_decode( file_get_contents( $manifest_path ), true );
  if ( ! is_array( $manifest ) ) { return; }

  $possible_entries = array('src/main.tsx','src/main.ts','src/index.tsx','src/index.ts');
  $entry = null;
  foreach ( $possible_entries as $c ) { if ( isset( $manifest[$c] ) ) { $entry = $manifest[$c]; break; } }
  if ( ! $entry ) { $first = reset($manifest); if ( isset($first['file']) ) $entry = $first; else return; }

  $ver = filemtime( $manifest_path );

  if ( ! empty( $entry['css'] ) && is_array( $entry['css'] ) ) {
    $i = 0;
    foreach ( $entry['css'] as $css ) {
      wp_enqueue_style('mmt-style-' . $i, MMT_PLUGIN_URL . 'dist/' . ltrim($css,'/'), array(), $ver);
      $i++;
    }
  }

  if ( ! empty( $entry['file'] ) ) {
    wp_enqueue_script('mmt-app', MMT_PLUGIN_URL . 'dist/' . ltrim($entry['file'],'/'), array(), $ver, true);
    wp_script_add_data('mmt-app', 'type', 'module');
  }
}
add_action( 'mmt_should_enqueue', 'mmt_enqueue_assets' );

function mmt_shortcode_cb( $atts = array(), $content = '' ) {
  do_action( 'mmt_should_enqueue' );
  return '<div id="mortgage-master-root"></div>';
}
add_shortcode( 'mortgage_master_toolkit', 'mmt_shortcode_cb' );