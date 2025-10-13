<?php
/*
Plugin Name: Mortgage Master Toolkit
Description: Renders the mortgage calculators (React bundle) via shortcode.
Version: 1.0.0
Author: Delvechio Designs
*/

if (!defined('ABSPATH')) { exit; }

/**
 * Enqueue assets only on pages that use the shortcode.
 * Expects npm packaging to place files at: assets/build/index.js and assets/build/style.css
 */
function mmtk_enqueue_assets() {
    if (!is_singular()) return;

    global $post;
    if (!($post instanceof WP_Post)) return;

    if (!has_shortcode($post->post_content, 'mortgage_master_toolkit')) return;

    wp_enqueue_style(
        'mmtk-style',
        plugins_url('assets/build/style.css', __FILE__),
        [],
        '1.0'
    );

    wp_enqueue_script(
        'mmtk-script',
        plugins_url('assets/build/index.js', __FILE__),
        [],
        '1.0',
        true
    );
}
add_action('wp_enqueue_scripts', 'mmtk_enqueue_assets');

/**
 * Shortcode output: stable mount target for your React app.
 * Your updated main.tsx already looks for [data-mmtk-root] (and #mortgage-master-root/#root).
 */
function mmtk_shortcode() {
    return '<div data-mmtk-root></div>';
}
add_shortcode('mortgage_master_toolkit', 'mmtk_shortcode');
